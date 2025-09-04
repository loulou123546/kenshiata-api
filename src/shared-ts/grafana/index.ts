import * as logs from "./logs";
import * as traces from "./traces";

async function flush() {
	traces.closeAllSpans();
	await logs.flushLogs();
	await traces.sendOTLPGrafana();
	logs.resetContext();
}

export const trace = traces.Tracer;
export type Span = traces.Span;
export type SpanStatus = traces.SpanStatus;
export const SpanStatusCode = traces.SpanStatusCode;
export const SpanKind = traces.SpanKind;

export function recordException(error: Error): logs.LogEntry {
	const span = traces.getActiveSpan();
	if (span) {
		span.recordException(error);
	}
	return logs.error(error);
}

export function addIndexLabel(labels: Record<string, string>) {
	logs.addIndexLabel(labels);
}

export function addContext(context: Record<string, unknown>) {
	logs.addContext(context);
	const span = traces.getParentSpan();
	if (span) {
		span.setAttributes(context);
	}
}

export function resetContext() {
	logs.resetContext();
}

export default {
	log: logs.log,
	warn: logs.warn,
	warning: logs.warning,
	error: logs.error,
	recordException,
	getActiveSpan: traces.getActiveSpan,
	flush,
	addIndexLabel,
	addContext,
	resetContext,
};
