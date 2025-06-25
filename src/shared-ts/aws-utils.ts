import arc from '@architect/functions';

export async function batchGetItems(tableName: string, keys: Record<string, string>[]): Promise<{results: Record<string, any>[], notProcessed: Record<string, string>[]}> {
    const client = await arc.tables();
    const lite_client = client._client;
    const table = client.name(tableName);
    if (keys.length < 1 || keys.length > 100) {
        throw new Error('Keys count must be between 1 and 100 items');
    }

    const res = await lite_client.BatchGetItem({
        RequestItems: {
          [table]: {
            ConsistentRead: false,
            Keys: keys,
          },
        },
    });

    return {
        results: res.Responses?.[table] ?? [],
        notProcessed: res.UnprocessedKeys?.[table] ?? [],
    }
}
