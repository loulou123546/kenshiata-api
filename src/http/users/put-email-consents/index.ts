import arc from "@architect/functions";
import {
	AdminUpdateUserAttributesCommand,
	CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";
import { z } from "zod";

const client = new CognitoIdentityProviderClient({});

export async function setUserData(
	username: string,
	email_consent: string,
): Promise<void> {
	const command = new AdminUpdateUserAttributesCommand({
		UserPoolId: process.env.COGNITO_USER_POOL_ID,
		Username: username,
		UserAttributes: [
			{
				Name: "custom:consent_email",
				Value: email_consent,
			},
		],
	});
	await client.send(command);
}

const EmailConsentData = z.object({
	email_consent: z.array(z.string()),
});

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

			const body = EmailConsentData.parse(req.body);

			await setUserData(id, body.email_consent.join(","));

			return {
				status: 200,
				cors: true,
				json: {
					ok: true,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					data: [],
					error: "Error while setting your user settings.",
				},
			};
		}
	}),
);
