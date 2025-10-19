import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { SignupRequest, type SignupResponse } from "@shared/types/Auth";
import { validateChallenge } from "shared/cloudflare-turnstile";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";
import { LoginUsingSession } from "../signup-confirm/index";

const client = new CognitoIdentityProviderClient({});

const SAFE_TO_FORWARD_ERROR_CODES = [
	"CodeDeliveryFailureException",
	"InvalidPasswordException",
	"UsernameExistsException",
];

export async function StartSignUp(
	input: SignupRequest,
	ip: string | undefined = undefined,
): Promise<SignupResponse> {
	const command = new SignUpCommand({
		ClientId: process.env.COGNITO_CLIENT_ID,
		Username: input.username,
		Password: input.password,
		UserAttributes: [
			{
				Name: "email",
				Value: input.email,
			},
			{
				Name: "custom:consent_email",
				Value: input.consent_email.join(","),
			},
		],
		UserContextData: {
			IpAddress: ip,
		},
	});
	const output = await client.send(command);
	if (output?.UserConfirmed && output?.Session) {
		return {
			userId: output.UserSub,
			...(await LoginUsingSession(input.username, output.Session, ip)),
		};
	}
	console.log(output);
	if (
		output?.CodeDeliveryDetails?.Destination &&
		output?.CodeDeliveryDetails?.DeliveryMedium &&
		output?.Session
	) {
		return {
			userId: output.UserSub,
			continue: {
				code_sent: true,
				code_sent_via: output.CodeDeliveryDetails.DeliveryMedium,
				code_sent_to: output.CodeDeliveryDetails.Destination,
				session_id: output.Session,
			},
		};
	}
	return {
		error: "Invalid input",
	};
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: SignupRequest;
		try {
			data = SignupRequest.parse(req.body);
		} catch {
			return {
				status: 400,
				cors: true,
				json: { error: "Invalid body" },
			};
		}
		try {
			// @ts-ignore IP may exist but not garanteed
			const ip: string | undefined = req?.requestContext?.http?.sourceIp;

			await validateChallenge(
				data.turnstileToken,
				"signup",
				["kenshiata.studio", "kenshiata.com"],
				ip,
			);
			const auth = await StartSignUp(data, ip);

			return {
				status: auth?.error ? 500 : 200,
				cors: true,
				json: auth,
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					error: SAFE_TO_FORWARD_ERROR_CODES.includes(error?.name)
						? error.name
						: "Failed to create account",
				},
			};
		}
	}),
);
