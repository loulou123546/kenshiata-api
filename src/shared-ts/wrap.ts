import type {
	APIGatewayProxyEvent,
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
	APIGatewayProxyStructuredResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import grafana, { trace, SpanKind, type Span } from "shared/grafana";
import type { SpanOptions } from "./grafana/traces";

type HandlerHttp = (
	request: APIGatewayProxyEventV2 | APIGatewayProxyEvent,
	context: Context,
) => Promise<APIGatewayProxyStructuredResultV2>;

type HandlerWS = (
	request: APIGatewayProxyWebsocketEventV2,
	context: Context,
) => Promise<APIGatewayProxyResultV2>;

const tracer = trace.getTracer("HTTP Request");

export function wrap_http(handler: HandlerHttp): HandlerHttp {
	return async (request: APIGatewayProxyEventV2, context: Context) => {
		try {
			const options: SpanOptions = {
				kind: SpanKind.SERVER,
			};
			if (request?.headers?.traceparent) {
				const parts = request.headers.traceparent.split("-");
				if (parts.length >= 3) {
					options.force_trace_id = parts[1];
					options.force_parent_span_id = parts[2];
				}
			}

			const res = await tracer.startActiveSpan(
				request?.requestContext?.routeKey ?? "Untitled request",
				options,
				async (span: Span) => {
					span.setAttributes({
						"faas.invocation_id": context?.awsRequestId || "unknown",
						"faas.trigger": "http",
						"faas.name": context?.functionName || "unknown",
						"faas.version": context?.functionVersion || "unknown",
						"http.route": request?.requestContext?.routeKey,
						"http.request.method":
							request?.requestContext?.http?.method || "unknown",
						"url.path": request.rawPath,
						"url.query":
							request?.rawQueryString ?? request?.queryStringParameters,
					});
					return await handler(request, context);
				},
			);

			await grafana.flush();
			return res;
		} catch (err) {
			await grafana.flush().catch(console.error);
			return { statusCode: 500 };
		}
	};
}

export function wrap_ws(handler: HandlerWS): HandlerWS {
	return async (request: APIGatewayProxyWebsocketEventV2, context: Context) => {
		try {
			const options: SpanOptions = {
				kind: SpanKind.CONSUMER,
			};
			try {
				const traceparent = JSON.parse(request.body)?.traceparent?.split("-");
				if (Array.isArray(traceparent) && traceparent.length >= 3) {
					options.force_trace_id = traceparent[1];
					options.force_parent_span_id = traceparent[2];
				}
			} catch {}

			const res = await tracer.startActiveSpan(
				request?.requestContext?.routeKey ?? "Untitled message event",
				options,
				async (span: Span) => {
					span.setAttributes({
						"faas.invocation_id": context?.awsRequestId || "unknown",
						"faas.trigger": "http",
						"faas.name": context?.functionName || "unknown",
						"faas.version": context?.functionVersion || "unknown",
						"messaging.destination.name": request?.requestContext?.routeKey,
						"messaging.operation.type": "receive",
						"messaging.message.id": request?.requestContext?.messageId,
						"messaging.message.conversation_id":
							request?.requestContext?.connectionId,
					});

					return await handler(request, context);
				},
			);

			await grafana.flush();
			return res;
		} catch (err) {
			await grafana.flush().catch(console.error);
			return { statusCode: 500 };
		}
	};
}
