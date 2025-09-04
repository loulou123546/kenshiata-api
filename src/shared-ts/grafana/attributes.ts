// biome-ignore lint/suspicious/noExplicitAny: here we want to check any kind of value
export function isDate(item: any) {
	return (
		item &&
		Object.prototype.toString.call(item) === "[object Date]" &&
		// biome-ignore lint/suspicious/noGlobalIsNan: force coercition is needed to parse Date as number
		!isNaN(item) &&
		typeof item?.toISOString === "function"
	);
}

// biome-ignore lint/suspicious/noExplicitAny: transform anything in string
export function transformToString(item: any): string {
	if (
		["string", "number", "bigint", "boolean", "function", "undefined"].includes(
			typeof item,
		)
	) {
		return String(item).substring(0, 250);
	}
	if (isDate(item)) {
		return item.toISOString();
	}
	if (Array.isArray(item)) {
		if (item.length <= 5)
			return `[${item.map(transformToString).join(", ")}]`.substring(0, 250);

		return `[${item.slice(0, 2).map(transformToString).join(", ")}, ...${item.length - 3} more, ${transformToString(
			item[item.length - 1],
		)}]`.substring(0, 250);
	}
	if (
		typeof item?.toString === "function" &&
		item.toString() !== "[object Object]"
	) {
		return item.toString().substring(0, 250);
	}
	return JSON.stringify(item).substring(0, 250);
}

export type Attributes = Record<string, string>;

export function parseAsAttributes(
	data: object,
	allowSpecialKeyCharacter = true,
): Attributes {
	if (typeof data !== "object" || !data) return {};
	return Object.fromEntries(
		Object.entries(data).map(([key, value]) => [
			allowSpecialKeyCharacter ? key : key.replace(/[^a-z0-9]+/gi, ""),
			transformToString(value),
		]),
	);
}

export function limitEntriesCount(attrs: Attributes, limit: number) {
	const entries = Object.entries(attrs);
	if (entries.length <= limit) return attrs;
	return Object.fromEntries(entries.slice(0, limit));
}

export function mapAttributes(
	attrs: Record<string, unknown>,
): { key: string; value: { stringValue: string } }[] {
	if (typeof attrs !== "object" || !attrs) return [];
	return Object.entries(attrs).map(([key, value]) => ({
		key,
		value: {
			stringValue: transformToString(value),
		},
	}));
}
