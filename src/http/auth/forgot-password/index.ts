import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	ForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ForgotPasswordRequest } from "@shared/types/Auth";
import { validateChallenge } from "shared/cloudflare-turnstile";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

const client = new CognitoIdentityProviderClient({});

export async function AskResetCode(
	input: ForgotPasswordRequest,
	ip: string | undefined = undefined,
): Promise<void> {
	try {
		const command = new ForgotPasswordCommand({
			ClientId: process.env.COGNITO_CLIENT_ID,
			Username: input.username,
			UserContextData: {
				IpAddress: ip,
			},
		});
		const output = await client.send(command);
		if (output?.CodeDeliveryDetails?.Destination) {
			grafana.warning(
				`User ${input.username} asked for password reset. Sent code to ${output.CodeDeliveryDetails.Destination}`,
			);
		} else {
			grafana.warning(
				`User ${input.username} asked for password reset. Not accound was found or unable to send code.`,
			);
		}
	} catch (error) {
		grafana.recordException(error);
	}
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: ForgotPasswordRequest;
		try {
			data = ForgotPasswordRequest.parse(req.body);
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
				"forgot-password",
				["kenshiata.studio", "kenshiata.com"],
				ip,
			);
			await AskResetCode(data, ip);

			return {
				status: 200,
				cors: true,
				json: {},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					error: "Failed to verify data",
				},
			};
		}
	}),
);
