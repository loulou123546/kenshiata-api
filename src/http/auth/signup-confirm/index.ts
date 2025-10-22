import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	ConfirmSignUpCommand,
	InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { ConfirmSignupRequest, type LoginResponse } from "@shared/types/Auth";
import grafana from "shared/grafana";
import { rateLimit } from "shared/rate-limit";
import { wrap_http } from "shared/wrap";

const client = new CognitoIdentityProviderClient({});

const SAFE_TO_FORWARD_ERROR_CODES = [
	"AliasExistsException",
	"CodeMismatchException",
	"ExpiredCodeException",
];

export async function LoginUsingSession(
	username: string,
	session: string,
	ip: string | undefined = undefined,
): Promise<LoginResponse> {
	const command = new InitiateAuthCommand({
		AuthFlow: "USER_AUTH",
		ClientId: process.env.COGNITO_CLIENT_ID,
		AuthParameters: {
			USERNAME: username,
		},
		Session: session,
		UserContextData: {
			IpAddress: ip,
		},
	});
	const output = await client.send(command);
	if (
		output?.AuthenticationResult?.AccessToken &&
		output?.AuthenticationResult?.IdToken &&
		output?.AuthenticationResult?.RefreshToken
	) {
		return {
			success: {
				access_token: output.AuthenticationResult.AccessToken,
				id_token: output.AuthenticationResult.IdToken,
				refresh_token: output.AuthenticationResult.RefreshToken,
			},
		};
	}
	console.log(output);
	return {
		error: "Unable to login using session",
	};
}

export async function ConfirmSignUp(
	input: ConfirmSignupRequest,
	ip: string | undefined = undefined,
): Promise<LoginResponse> {
	const command = new ConfirmSignUpCommand({
		ClientId: process.env.COGNITO_CLIENT_ID,
		Username: input.username,
		ConfirmationCode: input.code,
		UserContextData: {
			IpAddress: ip,
		},
	});
	const output = await client.send(command);
	if (output?.Session) {
		return await LoginUsingSession(input.username, output.Session, ip);
	}
	console.log(output);
	return {
		error: "Invalid confirmation code",
	};
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: ConfirmSignupRequest;
		try {
			data = ConfirmSignupRequest.parse(req.body);
		} catch {
			return {
				status: 400,
				cors: true,
				json: { error: "Invalid body" },
			};
		}

		try {
			await rateLimit(`signup-confirm:${data.username}`, 15, 300); // 15 attempt in 5 minutes
			await rateLimit("signup-confirm:__global", 150, 300); // no more than 150 attemps globally in 5 minutes
		} catch {
			return {
				status: 429,
				cors: true,
				json: { error: "Too many attempts, wait 5 minutes" },
			};
		}

		try {
			// @ts-ignore IP may exist but not garanteed
			const ip: string | undefined = req?.requestContext?.http?.sourceIp;
			const auth = await ConfirmSignUp(data, ip);

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
						: "Failed to confirm user creation",
				},
			};
		}
	}),
);
