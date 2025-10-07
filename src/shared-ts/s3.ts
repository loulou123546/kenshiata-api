import {
	CopyObjectCommand,
	type CopyObjectCommandOutput,
	type DeleteMarkerEntry,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	GetObjectCommand,
	GetObjectTaggingCommand,
	ListObjectVersionsCommand,
	ListObjectsV2Command,
	type ListObjectsV2CommandOutput,
	type ObjectVersion,
	PutObjectCommand,
	type PutObjectCommandInput,
	type PutObjectCommandOutput,
	PutObjectTaggingCommand,
	S3Client,
	type S3ClientConfig,
	type _Object,
} from "@aws-sdk/client-s3";
import { z } from "zod";

const ListOptions = z.object({
	starts_with: z.string().optional(),
	limit: z.number().optional(),
	paginate: z.enum(["once", "all"]),
});
export type ListOptions = z.infer<typeof ListOptions>;

export type S3Object = _Object;

export type S3KeyVersion =
	| string
	| {
			Key: string;
			VersionId?: string;
	  };

export type VersionEntry = (ObjectVersion | DeleteMarkerEntry) & {
	IsDeleteMarker: boolean;
};

export type S3ObjectSerialize = {
	blob: () => Promise<Uint8Array>;
	text: () => Promise<string>;
	json: () => Promise<unknown>;
};

class UnsafeKeyError extends Error {}
class UnsafeBucketNameError extends Error {}

// @ts-ignore Node.js 22 support unicode class without issues, but TS worry about it anyway
const safe_characters = /^[a-z0-9À-ÿœ_/!.*'() :-]+$/iu;
const safe_bucket_name = /^[a-z0-9][a-z0-9\.\-]+[a-z0-9]$/;
const unsafe_tags_characters = /[^a-z0-9 \+\-\._:/@]/gi; // should allow "=" normally, but we don't allow it here

export function isSafeKey(key: string): boolean {
	if (key.includes("..")) return false;
	if (key.startsWith("/")) return false;
	if (!safe_characters.test(key)) return false;
	return true;
}
function assertKeySafe(key: S3KeyVersion): void {
	if (typeof key === "string") {
		if (!isSafeKey(key)) throw new UnsafeKeyError();
	} else if (!isSafeKey(key.Key)) throw new UnsafeKeyError();
}
function safeBucketName(name: string): void {
	if (typeof name !== "string") throw new UnsafeBucketNameError();
	if (name.length < 3) throw new UnsafeBucketNameError();
	if (name.length > 63) throw new UnsafeBucketNameError();
	if (name.includes("..")) throw new UnsafeBucketNameError();
	if (!safe_bucket_name.test(name)) throw new UnsafeBucketNameError();
}
function safe_tag(text: string): string {
	return text.replace(unsafe_tags_characters, "");
}

class S3 {
	bucket: string;
	client: S3Client;

	constructor(bucket: string, options: S3ClientConfig) {
		this.bucket = bucket;
		this.client = new S3Client({
			...options,
		});
	}

	async delete(key: S3KeyVersion | S3KeyVersion[]): Promise<void> {
		if (Array.isArray(key)) {
			for (const each_key of key) {
				assertKeySafe(each_key);
			}
			const command = new DeleteObjectsCommand({
				Bucket: this.bucket,
				Delete: {
					Objects: key.map((k: S3KeyVersion) => {
						if (typeof k === "string") return { Key: k };
						return {
							Key: k.Key,
							VersionId: k.VersionId,
						};
					}),
				},
			});
			await this.client.send(command);
		} else {
			assertKeySafe(key);
			const command = new DeleteObjectCommand({
				Bucket: this.bucket,
				Key: typeof key === "string" ? key : key.Key,
				VersionId: typeof key === "string" ? undefined : key.VersionId,
			});
			await this.client.send(command);
		}
	}

	async get(key: S3KeyVersion): Promise<S3ObjectSerialize> {
		assertKeySafe(key);
		const command = new GetObjectCommand({
			Bucket: this.bucket,
			Key: typeof key === "string" ? key : key.Key,
			VersionId: typeof key === "string" ? undefined : key.VersionId,
		});
		const res = await this.client.send(command);
		return {
			blob: async (): Promise<Uint8Array> => {
				/* istanbul ignore next -- @preserve */
				if (!res.Body) throw new Error("S3 reponse missing Body stream");
				const body = await res.Body.transformToByteArray();
				return body;
			},
			text: async (): Promise<string> => {
				/* istanbul ignore next -- @preserve */
				if (!res.Body) throw new Error("S3 reponse missing Body stream");
				const body = await res.Body.transformToString("utf-8");
				return body;
			},
			json: async (): Promise<unknown> => {
				/* istanbul ignore next -- @preserve */
				if (!res.Body) throw new Error("S3 reponse missing Body stream");
				const body = await res.Body.transformToString("utf-8");
				return JSON.parse(body);
			},
		};
	}

	async getTags(key: S3KeyVersion): Promise<Record<string, string>> {
		assertKeySafe(key);
		const command = new GetObjectTaggingCommand({
			Bucket: this.bucket,
			Key: typeof key === "string" ? key : key.Key,
			VersionId: typeof key === "string" ? undefined : key.VersionId,
		});
		const res = await this.client.send(command);
		const tags: Record<string, string> = {};
		for (const tag of res.TagSet ||
			/* istanbul ignore next -- @preserve */ []) {
			/* istanbul ignore else -- @preserve */
			if (typeof tag.Key === "string" && typeof tag.Value === "string")
				tags[tag.Key] = tag.Value;
		}
		return tags;
	}

	async listVersions(key: string): Promise<VersionEntry[]> {
		assertKeySafe(key);
		const command = new ListObjectVersionsCommand({
			Bucket: this.bucket,
			Prefix: key,
		});
		const res = await this.client.send(command);
		return [
			...(res.Versions ?? []).map((el) => ({ ...el, IsDeleteMarker: false })),
			...(res.DeleteMarkers ?? []).map((el) => ({
				...el,
				IsDeleteMarker: true,
			})),
		];
	}

	async put(
		key: S3KeyVersion,
		body: string | Uint8Array | Buffer | ReadableStream,
		options?: Omit<
			PutObjectCommandInput,
			"Bucket" | "Key" | "Body" | "Tagging"
		> & { tags?: Record<string, string> },
	): Promise<PutObjectCommandOutput> {
		assertKeySafe(key);
		if (options?.tags) {
			// @ts-ignore Tagging was disallowed for end-users (replaced by tags) but still accepted by AWS
			options.Tagging = Object.entries(options.tags)
				.map(([name, value]) => `${safe_tag(name)}=${safe_tag(value)}`)
				.join("&");
			delete options.tags;
		}
		const command = new PutObjectCommand({
			Bucket: this.bucket,
			Key: typeof key === "string" ? key : key.Key,
			Body: body,
			...options,
		});
		return await this.client.send(command);
	}

	async putTags(
		key: S3KeyVersion,
		tags: Record<string, string>,
	): Promise<void> {
		assertKeySafe(key);
		const TagSet: { Key: string; Value: string }[] = [];
		for (const [name, value] of Object.entries(tags)) {
			TagSet.push({ Key: safe_tag(name), Value: safe_tag(value) });
		}
		const command = new PutObjectTaggingCommand({
			Bucket: this.bucket,
			Key: typeof key === "string" ? key : key.Key,
			VersionId: typeof key === "string" ? undefined : key.VersionId,
			Tagging: { TagSet },
		});
		await this.client.send(command);
	}

	async list(options: ListOptions): Promise<S3Object[]> {
		if (options.starts_with) assertKeySafe(options.starts_with);
		let continue_token: string | undefined = undefined;
		let results: S3Object[] = [];
		do {
			const command = new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: options.starts_with,
				MaxKeys: options.limit,
				ContinuationToken: continue_token,
			});
			const response: ListObjectsV2CommandOutput =
				await this.client.send(command);
			continue_token = response.NextContinuationToken;
			if (response.Contents) {
				results = [...results, ...response.Contents];
			}
		} while (
			options.paginate === "all" &&
			continue_token !== undefined &&
			(options?.limit ? results.length < options.limit : true)
		);
		return results;
	}

	async *iterateList(
		options: Omit<ListOptions, "paginate">,
	): AsyncGenerator<S3Object[]> {
		if (options.starts_with) assertKeySafe(options.starts_with);
		let continue_token: string | undefined = undefined;
		do {
			const command = new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: options.starts_with,
				MaxKeys: options.limit,
				ContinuationToken: continue_token,
			});
			const response: ListObjectsV2CommandOutput =
				await this.client.send(command);
			continue_token = response.NextContinuationToken;
			if (response.Contents) {
				yield response.Contents;
			}
		} while (continue_token !== undefined);
	}

	async copy(
		source: S3KeyVersion,
		destination: string,
		source_bucket?: string,
	): Promise<CopyObjectCommandOutput> {
		let src = typeof source === "string" ? source : source.Key;
		src = `${source_bucket ?? this.bucket}/${src}`;
		assertKeySafe(src);
		assertKeySafe(destination);

		if (typeof source !== "string" && source.VersionId) {
			// '?' is unsafe in key, but here it's not part of the key, so we add it after assertKeySafe
			src = `${src}?versionId=${source.VersionId}`;
		}

		if (source_bucket) safeBucketName(source_bucket);
		const command = new CopyObjectCommand({
			Bucket: this.bucket,
			CopySource: src,
			Key: destination,
		});
		return await this.client.send(command);
	}
}

export default function (bucket: string, options?: S3ClientConfig) {
	safeBucketName(bucket);
	return new S3(bucket, options ?? {});
}
