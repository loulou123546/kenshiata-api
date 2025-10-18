import { inspect } from "node:util";
import {
	type Attributes,
	mapAttributes,
	parseAsAttributes,
	transformToString,
} from "./attributes";

export enum SpanKind {
	UNSPECIFIED = 0,
	INTERNAL = 1,
	SERVER = 2,
	CLIENT = 3,
	PRODUCER = 4,
	CONSUMER = 5,
}

export type Event = {
	timeUnixNano: string; // nanoseconds since epoch (`${Date.now()}000000`)
	name: string; // non empty
	attributes: Attributes;
};

export type Link = {
	traceId: string; // 16 bytes
	spanId: string; // 8 bytes
	traceState?: string; // https://www.w3.org/TR/trace-context/#tracestate-header
	attributes: Attributes;
	flags?: number; // https://github.com/open-telemetry/opentelemetry-proto/blob/2bd940b2b77c1ab57c27166af21384906da7bb2b/opentelemetry/proto/trace/v1/trace.proto#L288
};

export enum SpanStatusCode {
	UNSET = 0,
	OK = 1,
	ERROR = 2,
}

export type SpanStatus = {
	message?: string;
	code: SpanStatusCode;
};

export type SpanOptions = {
	attributes?: Attributes;
	kind?: SpanKind;
	links?: Link[];
	root?: boolean;
	startTime?: Date | number;
	force_trace_id?: string;
	force_parent_span_id?: string;
};

const GLOBAL_METADATA: Attributes = {
	"service.name": "kenshiata-api",
	environment: process.env?.RUNNING_ENV ?? "unknown",
	"service.version": "1.0.0",
};

let ACTIVE_SPANS: Span[] = [];
const TRACER_QUEUE: Tracer[] = [];

function generateHexValue(bytes_size: number): string {
	let value = "";
	for (let i = 0; i < bytes_size; i++) {
		value += Math.floor(Math.random() * 256)
			.toString(16)
			.padStart(2, "0");
	}
	return value;
}

export class Span {
	traceId: string; // 16 bytes
	spanId: string; // 8 bytes
	traceState?: string; // https://www.w3.org/TR/trace-context/#tracestate-header
	parentSpanId?: string; // 8 bytes
	flags?: number; // https://github.com/open-telemetry/opentelemetry-proto/blob/2bd940b2b77c1ab57c27166af21384906da7bb2b/opentelemetry/proto/trace/v1/trace.proto#L114
	name: string; // non empty
	kind: SpanKind;
	startTimeUnixNano: string; // nanoseconds since epoch (`${Date.now()}000000`)
	endTimeUnixNano: string; // nanoseconds since epoch (`${Date.now()}000000`)
	attributes: Attributes;
	events: Event[];
	links: Link[];
	status: SpanStatus;

	constructor(traceId: string, name: string, parentSpanId?: string) {
		this.traceId = traceId;
		this.spanId = generateHexValue(8);
		if (parentSpanId) {
			this.parentSpanId = parentSpanId;
		}
		this.name = name;
		this.kind = SpanKind.INTERNAL;
		this.startTimeUnixNano = `${Date.now()}000000`;
		this.endTimeUnixNano = "";
		this.attributes = {};
		this.events = [];
		this.links = [];
		this.status = { code: SpanStatusCode.UNSET };
	}

	setAttribute(key: string, value: unknown): void {
		this.attributes[key] = transformToString(value);
	}

	setAttributes(attrs: object): void {
		this.attributes = {
			...this.attributes,
			...parseAsAttributes(attrs),
		};
	}

	addLink(link: Link): void {
		this.links.push(link);
	}
	addLinks(links: Link[]): void {
		links.forEach(this.addLink, this);
	}

	addEvent(name: string): void;
	addEvent(name: string, attributes: Attributes): void;
	addEvent(name: string, startTime: Date | number): void;
	addEvent(
		name: string,
		attributes: Attributes,
		startTime: Date | number,
	): void;
	addEvent(
		name: string,
		attributesOrStartTime?: Attributes | Date | number,
		startTime?: Date | number,
	) {
		let attributes: Attributes = {};
		let time = Date.now();
		if (typeof startTime === "number") {
			time = startTime;
		} else if (startTime instanceof Date) {
			time = startTime.getTime();
		} else if (typeof attributesOrStartTime === "number") {
			time = attributesOrStartTime;
		} else if (attributesOrStartTime instanceof Date) {
			time = attributesOrStartTime.getTime();
		} else {
			attributes = attributesOrStartTime;
		}
		if (typeof startTime !== "undefined") {
			attributes = attributesOrStartTime as Attributes;
		}
		this.events.push({
			timeUnixNano: `${time}000000`,
			name,
			attributes: parseAsAttributes(attributes),
		});
	}

	end(end?: Date | number): void {
		if (typeof end === "number") {
			this.endTimeUnixNano = `${end}000000`;
		} else if (end instanceof Date) {
			this.endTimeUnixNano = `${end.getTime()}000000`;
		} else {
			this.endTimeUnixNano = `${Date.now()}000000`;
		}
		ACTIVE_SPANS = ACTIVE_SPANS.filter((span) => span.spanId !== this.spanId);
		console.log(
			`[${Number(this.endTimeUnixNano) / 1000000 - Number(this.startTimeUnixNano) / 1000000} ms] ${this.name}\n\t${inspect(this.attributes, { breakLength: Number.POSITIVE_INFINITY })}`,
		);
	}

	isRecording(): boolean {
		return this.endTimeUnixNano === "";
	}

	setStatus(status: SpanStatus): void {
		this.status = status;
	}

	recordException(error: Error, time?: Date | number): void {
		console.error(error);
		this.addEvent(
			"exception",
			{
				// @ts-ignore https://nodejs.org/api/errors.html#errorcode
				"exception.type": error?.name ?? error?.code,
				"exception.message": error.message,
				"exception.stacktrace": error.stack,
			},
			time,
		);
		this.setStatus({
			code: SpanStatusCode.ERROR,
			message: error.message,
		});
	}

	updateName(name: string): void {
		this.name = name;
	}
}

export class Tracer {
	name: string;
	version: string;
	attributes: Attributes;
	spans: Span[];

	constructor(name: string, version = "1.0.0") {
		this.name = name;
		this.version = version;
		this.attributes = {};
		this.spans = [];
	}

	// biome-ignore lint/suspicious/noExplicitAny: signature must allow any return
	startActiveSpan<F extends (span: Span) => any>(
		name: string,
		cb: F,
	): ReturnType<F>;
	// biome-ignore lint/suspicious/noExplicitAny: signature must allow any return
	startActiveSpan<F extends (span: Span) => any>(
		name: string,
		options: SpanOptions,
		cb: F,
	): ReturnType<F>;
	// biome-ignore lint/suspicious/noExplicitAny: signature must allow any return
	startActiveSpan<F extends (span: Span) => any>(
		name: string,
		optionsORcb: F | SpanOptions,
		cb?: F,
	): ReturnType<F> {
		const options: SpanOptions =
			typeof optionsORcb === "function" ? {} : optionsORcb;
		const callback: F = typeof optionsORcb === "function" ? optionsORcb : cb;

		let latest_span: Span | undefined;
		if (ACTIVE_SPANS.length > 0) {
			latest_span = ACTIVE_SPANS[ACTIVE_SPANS.length - 1];
		}
		const span = new Span(
			options?.force_trace_id ?? latest_span?.traceId ?? generateHexValue(16),
			name,
			options?.force_parent_span_id ??
				(options?.root ? undefined : latest_span?.spanId),
		);
		if (options?.kind !== undefined) span.kind = options?.kind;
		if (options?.attributes !== undefined)
			span.setAttributes(options.attributes);
		if (options?.startTime !== undefined) {
			if (options.startTime instanceof Date) {
				span.startTimeUnixNano = `${options.startTime.getTime()}000000`;
			} else {
				span.startTimeUnixNano = `${options.startTime}000000`;
			}
		}
		this.spans.push(span);
		ACTIVE_SPANS.push(span);
		return callback(span);
	}

	setAttribute(key: string, value: unknown): void {
		this.attributes[key] = transformToString(value);
	}

	setAttributes(attributes: object): void {
		this.attributes = {
			...this.attributes,
			...parseAsAttributes(attributes),
		};
	}

	static getTracer(name: string, version = "1.0.0"): Tracer {
		const track = new Tracer(name, version);
		TRACER_QUEUE.push(track);
		return track;
	}
}

export function getActiveSpan(): Span | undefined {
	if (ACTIVE_SPANS.length > 0) {
		return ACTIVE_SPANS[ACTIVE_SPANS.length - 1];
	}
	return undefined;
}

export function getParentSpan(): Span | undefined {
	if (ACTIVE_SPANS.length > 0) {
		return ACTIVE_SPANS[0];
	}
	return undefined;
}

export function closeAllSpans(): void {
	let max_rounds = 999;
	while (ACTIVE_SPANS.length > 0 && max_rounds > 0) {
		max_rounds--;
		const span = ACTIVE_SPANS[ACTIVE_SPANS.length - 1];
		span.end();
	}
}

export async function sendOTLPGrafana(): Promise<boolean> {
	if (!process.env?.TRACES_ENDPOINT) return false;
	return await sendToOpenTelemetry(process.env.TRACES_ENDPOINT, {
		headers: {
			"Content-Type": "application/json",
			Authorization: `Basic ${process.env.TRACES_AUTH}`,
		},
	});
}

async function sendToOpenTelemetry(
	url: string,
	fetchOptions,
): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10000);
		const res = await fetch(url, {
			...fetchOptions,
			signal: controller.signal,
			method: "POST",
			body: JSON.stringify({
				resourceSpans: [
					{
						resource: {
							attributes: mapAttributes(GLOBAL_METADATA),
						},
						scopeSpans: TRACER_QUEUE.map((tracer) => ({
							scope: {
								name: tracer.name,
								version: tracer.version,
								attributes: mapAttributes(tracer.attributes),
							},
							spans: tracer.spans.map((span) => {
								if (span.endTimeUnixNano === "") {
									span.end();
								}
								return {
									traceId: span.traceId,
									spanId: span.spanId,
									traceState: span?.traceState,
									parentSpanId: span?.parentSpanId,
									name: span.name,
									startTimeUnixNano: span.startTimeUnixNano,
									endTimeUnixNano:
										span?.endTimeUnixNano ?? `${Date.now()}000000`,
									kind: span.kind,
									attributes: mapAttributes(span.attributes),
									events: span.events.map((event) => ({
										timeUnixNano: event.timeUnixNano,
										name: event.name,
										attributes: mapAttributes(event.attributes),
									})),
									links: span.links.map((link) => ({
										traceId: link.traceId,
										spanId: link.spanId,
										traceState: link?.traceState,
										attributes: mapAttributes(link.attributes),
										flags: link?.flags,
									})),
									status: span.status,
								};
							}),
						})),
					},
				],
			}),
		});
		clearTimeout(timer);
		if (res.ok) {
			// set TRACER_QUEUE to [] only if this is last run
			return true;
		}
		console.error("Failed to send traces to OpenTelemetry:");
		console.error(await res.text());
	} catch (e) {
		console.error("Failed to send traces to OpenTelemetry:");
		console.error(e);
	}
	return false;
}
