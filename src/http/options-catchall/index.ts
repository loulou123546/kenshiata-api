import arc from "@architect/functions";

export const handler = arc.http(async (req) => {
	return {
		status: 200,
		text: "OK",
		cors: true,
		headers: {
			"content-type": "text/plain",
			"access-control-allow-origin": "*",
			"access-control-allow-headers":
				"Origin, Content-Type, Accept, Cookie, Authorization, traceparent",
			"access-control-allow-methods":
				"OPTIONS, POST, GET, PUT, DELETE, PATCH, HEAD",
		},
	};
});
