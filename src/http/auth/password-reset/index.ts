import arc from "@architect/functions";
import type { HttpRequest } from "@architect/functions/types/http";
import {
	CognitoIdentityProviderClient,
	ConfirmForgotPasswordCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { type LoginResponse, ResetPasswordRequest } from "@shared/types/Auth";
import grafana from "shared/grafana";
import { rateLimit } from "shared/rate-limit";
import { wrap_http } from "shared/wrap";
import { initAuth } from "../login/index";

const client = new CognitoIdentityProviderClient({});

const SAFE_TO_FORWARD_ERROR_CODES = [
	"AliasExistsException",
	"CodeMismatchException",
	"ExpiredCodeException",
	"PasswordHistoryPolicyViolationException",
];

export async function ResetPassword(
	input: ResetPasswordRequest,
	ip: string | undefined = undefined,
): Promise<LoginResponse> {
	const command = new ConfirmForgotPasswordCommand({
		ClientId: process.env.COGNITO_CLIENT_ID,
		Username: input.username,
		Password: input.password,
		ConfirmationCode: input.code,
		UserContextData: {
			IpAddress: ip,
		},
	});
	await client.send(command);
	try {
		return await initAuth(
			{ username: input.username, password: input.password },
			ip,
		);
	} catch {
		return {
			error: "LoginAfterResetFailed",
		};
	}
}

export const handler = wrap_http(
	arc.http(async (req: HttpRequest) => {
		let data: ResetPasswordRequest;
		try {
			data = ResetPasswordRequest.parse(req.body);
		} catch {
			return {
				status: 400,
				cors: true,
				json: { error: "Invalid body" },
			};
		}

		try {
			await rateLimit(`reset-password:${data.username}`, 15, 300); // 15 attempt in 5 minutes
			await rateLimit("reset-password:__global", 100, 300); // no more than 100 attemps globally in 5 minutes
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
			const auth = await ResetPassword(data, ip);

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
						: "Failed to reset user password using code",
				},
			};
		}
	}),
);
