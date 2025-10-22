import arc from "@architect/functions";
import grafana from "./grafana";

export async function rateLimit(
	key: string,
	max: number,
	reset_timer: number,
): Promise<number> {
	const now_in_seconds = Math.round(Date.now() / 1000);
	const client = (await arc.tables()).rateLimit;

	let attributes = undefined;
	try {
		// this call consume only one write unit, and returning updated attributes doesn't consume read units
		// We ask to increment call_count by one and set expiration to <reset_timer> seconds in the future
		// Due to condition, we throw if an old, expired, entry is found. In this case, we reset the counter after (catch).
		// In case there is no entry (initial setup), entry is created automatically.
		const attempt = await client.update({
			Key: { id: key },
			// @ts-ignore ConditionExpression exist
			ConditionExpression: "attribute_not_exists(expires) OR expires >= :now",
			ExpressionAttributeValues: {
				":inc": 1,
				":now": now_in_seconds,
				":exp": now_in_seconds + reset_timer,
			},
			UpdateExpression: "ADD call_count :inc SET expires = :exp",
			ReturnValues: "ALL_NEW",
		});
		attributes = attempt?.Attributes;
	} catch (e) {
		if (e.name === "ConditionalCheckFailedException") {
			// Condition only fail if entry exist but is expired, so we reset the counter
			await client.update({
				Key: { id: key },
				// @ts-ignore ExpressionAttributeValues exist
				ExpressionAttributeValues: {
					":inc": 1,
					":exp": now_in_seconds + reset_timer,
				},
				UpdateExpression: "SET call_count = :inc, expires = :exp",
			});
			return max - 1;
		}
		grafana.recordException(e);
		throw e;
	}

	if (attributes?.call_count > max) {
		throw new Error(
			`rate-limiting: too many calls, wait ${reset_timer} seconds`,
		);
	}
	return max - attributes?.call_count;
}

export async function resetRateLimits(key: string) {
	const client = (await arc.tables()).rateLimit;
	await client.delete({ id: key });
}

export type filterFunction = (rate_limit: {
	id: string;
	call_count: number;
	expires: number;
}) => boolean;

export async function resetAllRateLimits(filter: filterFunction | undefined) {
	if (filter === undefined) {
		return await resetAllRateLimits(() => true);
	}
	const client = (await arc.tables()).rateLimit;
	const all = await client.scan({});
	await Promise.all(
		all.Items.filter(filter).map((item) => client.delete({ id: item.id })),
	);
}
