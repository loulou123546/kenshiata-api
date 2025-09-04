import arc from "@architect/functions";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(async (req) => {
		try {
			const client = (await arc.tables()).playersOnline;
			const list = await client.scan();
			return {
				status: 200,
				cors: true,
				json: list.Items,
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 404,
				cors: true,
				json: { error: "No offers found" },
			};
		}
	}),
);
