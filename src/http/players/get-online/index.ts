import arc from "@architect/functions";

export const handler = arc.http(async (req) => {
	try {
		const client = (await arc.tables()).playersOnline;
		const list = await client.scan();
		return {
			status: 200,
			cors: true,
			json: list.Items,
		};
	} catch (error) {
		console.error("Error listing players online:", error);
		return {
			status: 404,
			cors: true,
			json: { error: "No offers found" },
		};
	}
});
