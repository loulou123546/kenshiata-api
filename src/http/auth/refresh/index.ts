import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	GetTokensFromRefreshTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
	RefreshTokenRequest,
	type RefreshTokenResponse,
} from "@shared/types/Auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

const client = new CognitoIdentityProviderClient({});

export async function refreshTokens(
	refresh: string,
): Promise<RefreshTokenResponse> {
	const command = new GetTokensFromRefreshTokenCommand({
		ClientId: process.env.COGNITO_CLIENT_ID,
		RefreshToken: refresh,
	});
	const output = await client.send(command);
	if (
		output?.AuthenticationResult?.AccessToken &&
		output?.AuthenticationResult?.IdToken
	) {
		return {
			success: {
				access_token: output.AuthenticationResult.AccessToken,
				id_token: output.AuthenticationResult.IdToken,
				refresh_token: output.AuthenticationResult?.RefreshToken,
			},
		};
	}
	console.log(output);
	return {
		error: "Invalid or Expired refresh token",
	};
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: RefreshTokenRequest;
		try {
			data = RefreshTokenRequest.parse(req.body);
		} catch {
			return {
				status: 400,
				cors: true,
				json: { error: "Invalid body" },
			};
		}

		try {
			const auth = await refreshTokens(data.refresh_token);

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
				json: { error: "Failed to refresh token" },
			};
		}
	}),
);
