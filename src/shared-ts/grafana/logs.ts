import {
	type Attributes,
	limitEntriesCount,
	parseAsAttributes,
	transformToString,
} from "./attributes";
import { getActiveSpan } from "./traces";

const LOGS_QUEUE: LogEntry[] = [];
let LOGS_SENDING: LogEntry[] = [];

export enum LogLevel {
	INFO = "info",
	WARNING = "warning",
	ERROR = "error",
}

const GLOBAL_METADATA: Attributes = {
	service_name: "kenshiata-api",
	environment: process.env?.RUNNING_ENV ?? "unknown",
	version: "1.0.0",
};
let LOGS_CONTEXT: Attributes = {};

export function addIndexLabel(labels: Attributes) {
	for (const [key, value] of Object.entries(labels)) {
		if (typeof key === "string" && typeof value === "string")
			GLOBAL_METADATA[key] = value;
	}
}

export function addContext(metadata: Record<string, unknown>) {
	LOGS_CONTEXT = {
		...LOGS_CONTEXT,
		...parseAsAttributes(metadata, false),
	};
}

export function resetContext() {
	LOGS_CONTEXT = {};
}

export class LogEntry {
	timestamp: string;
	message: string;
	level: LogLevel;
	metadata: Record<string, string>;

	constructor(level: LogLevel, message: unknown) {
		this.level = level;
		this.message = Array.isArray(message)
			? message.map(transformToString).join(" ")
			: transformToString(message);
		this.timestamp = `${Date.now().toString()}000000`;
		this.metadata = {};
	}

	meta(metadata: Record<string, unknown>): this {
		this.metadata = {
			...this.metadata,
			...parseAsAttributes(metadata, false),
		};
		return this;
	}

	append(...data: unknown[]): this {
		this.message +=
			// biome-ignore lint/style/useTemplate: avoid a mess for using `` with such a big block of code
			" " +
			(Array.isArray(data)
				? data.map(transformToString).join(" ")
				: transformToString(data));
		return this;
	}
}

function generic_log(level: LogLevel, ...data: unknown[]): LogEntry {
	switch (level) {
		case "error":
			console.error(data);
			break;
		case "warning":
			console.warn(data);
			break;
		default:
			console.log(data);
			break;
	}
	const log = new LogEntry(level, data);
	const span = getActiveSpan();
	if (span?.traceId) {
		log.meta({ traceID: span.traceId });
	}
	LOGS_QUEUE.push(log);
	return log;
}

export function log(...data): LogEntry {
	return generic_log(LogLevel.INFO, ...data);
}

export function warn(...data): LogEntry {
	return generic_log(LogLevel.WARNING, ...data);
}

export function warning(...data): LogEntry {
	return generic_log(LogLevel.WARNING, ...data);
}

export function error(...data): LogEntry {
	return generic_log(LogLevel.ERROR, ...data);
}

export async function flushLogs(): Promise<void> {
	let rounds = 5;

	try {
		while ((LOGS_QUEUE.length > 0 || LOGS_SENDING.length > 0) && rounds > 0) {
			await prepareLogs();
			rounds--;
		}
	} catch (e) {
		console.error("Failed to flush logs:");
		console.error(e);
	}
}

async function prepareLogs(): Promise<boolean> {
	if (LOGS_SENDING.length === 0 && LOGS_QUEUE.length === 0) {
		return true;
	}
	if (LOGS_SENDING.length === 0) {
		LOGS_SENDING = LOGS_QUEUE.splice(0, 20);
	}

	if (LOGS_SENDING.length > 0) {
		const ok = await sendToLoki();
		if (ok) {
			LOGS_SENDING = [];
			return true;
		}
		return false;
	}
	return true;
}

async function sendToLoki(): Promise<boolean> {
	if (!process.env?.LOKI_ENDPOINT) return false;
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10000);
		const res = await fetch(process.env.LOKI_ENDPOINT, {
			signal: controller.signal,
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${process.env.LOKI_AUTH}`,
			},
			body: JSON.stringify({
				streams: [
					{
						stream: limitEntriesCount(
							{
								...GLOBAL_METADATA,
							},
							15,
						),
						values: LOGS_SENDING.map((log) => [
							log.timestamp,
							log.message,
							limitEntriesCount(
								{ ...LOGS_CONTEXT, level: log.level, ...log.metadata },
								96,
							),
						]),
					},
				],
			}),
		});
		clearTimeout(timer);
		if (res.ok) {
			return true;
		}
		console.error("Failed to send logs to Loki:");
		console.error(await res.text());
	} catch (e) {
		console.error("Failed to send logs to Loki:");
		console.error(e);
	}
	return false;
}
