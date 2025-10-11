import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { LoginRequest, type LoginResponse } from "@shared/types/Auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

const client = new CognitoIdentityProviderClient({});

export async function initAuth(
	input: LoginRequest,
	ip: string | undefined = undefined,
): Promise<LoginResponse> {
	const command = new InitiateAuthCommand({
		AuthFlow: "USER_PASSWORD_AUTH",

		ClientId: process.env.COGNITO_CLIENT_ID,
		AuthParameters: {
			USERNAME: input.username,
			PASSWORD: input.password,
		},
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
	if (output?.ChallengeName && output?.Session) {
		return {
			continue: {
				challenge: output.ChallengeName,
				session_id: output.Session,
			},
		};
	}
	return {
		error: "Invalid credentials",
	};
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: LoginRequest;
		try {
			data = LoginRequest.parse(req.body);
		} catch {
			return {
				status: 400,
				cors: true,
				json: { error: "Invalid body" },
			};
		}
		try {
			// @ts-ignore IP may exist but not garanteed
			const auth = await initAuth(data, req?.requestContext?.http?.sourceIp);

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
				json: { error: "Failed to authentificate" },
			};
		}
	}),
);
