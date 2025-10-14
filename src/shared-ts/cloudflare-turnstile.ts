import grafana from "shared/grafana";
import { z } from "zod";

export const TurnstileResponse = z.object({
	success: z.boolean(),
	challenge_ts: z.string(),
	hostname: z.string().optional(),
	"error-codes": z.array(z.string()),
	action: z.string().optional(),
});
export type TurnstileResponse = z.infer<typeof TurnstileResponse>;

export async function validateChallenge(
	token: string,
	expected_action: string,
	expected_domains: string | string[],
	ip: string | undefined = undefined,
): Promise<void> {
	try {
		const response = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					secret: process.env.CLOUDFLARE_TURNSTILE_SECRET,
					response: token,
					remoteip: ip,
				}),
			},
		);

		const validation = TurnstileResponse.parse(await response.json());

		if (!validation.success)
			throw new Error(
				`Failed turnstile validation: ${validation["error-codes"].join(", ")}`,
			);

		if (validation.action !== expected_action)
			throw new Error(`Invalid action: ${validation.action}`);

		if (![expected_domains].flat().includes(validation.hostname))
			throw new Error(`Invalid hostname: ${validation.hostname}`);

		const challengeTime = new Date(validation.challenge_ts);
		const now = new Date();
		const ageMinutes = (now.getTime() - challengeTime.getTime()) / (1000 * 60);
		if (ageMinutes > 5)
			throw new Error(`Challenge expired: ${ageMinutes} minutes`);
		if (ageMinutes > 4)
			grafana.warn("Received a Turnstile challenge older than 4 minutes");
	} catch (error) {
		grafana.recordException(error);
		throw new Error("Turnstile validation error");
	}
}
