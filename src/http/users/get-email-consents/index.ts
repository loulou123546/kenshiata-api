import arc from "@architect/functions";
import {
	AdminGetUserCommand,
	type AttributeType,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

const client = new CognitoIdentityProviderClient({});

export async function getUserData(username: string): Promise<AttributeType[]> {
	const command = new AdminGetUserCommand({
		UserPoolId: process.env.COGNITO_USER_POOL_ID,
		Username: username,
	});
	const output = await client.send(command);
	return output?.UserAttributes || [];
}

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			let id = req.params?.id;
			if (id === "me") {
				id = req.user.username;
			}

			if (id !== req.user.username) {
				return {
					status: 403,
					cors: true,
					json: {
						data: [],
						error: "Forbidden",
					},
				};
			}

			const attributes = await getUserData(id);

			const emailConsent = attributes.find((attr) => {
				return attr.Name === "custom:consent_email";
			});

			return {
				status: 200,
				cors: true,
				json: {
					consents: emailConsent?.Value ? emailConsent.Value.split(",") : [],
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					data: [],
					error: "Error while getting your actual user settings.",
				},
			};
		}
	}),
);
