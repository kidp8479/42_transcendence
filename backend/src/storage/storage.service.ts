// StorageService: thin wrapper around the AWS S3 SDK pointed at RustFS.
// RustFS speaks the S3 API, so the official SDK works against it as long as
// forcePathStyle is set (RustFS, like MinIO, doesn't support the
// bucket.endpoint virtual-hosted addressing style).

import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import type { Readable } from "stream";

export interface StoredObject {
  body: Readable;
  contentType?: string;
}

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  // Buckets we've already confirmed/created this process lifetime, so
  // ensureBucket doesn't round-trip to RustFS on every single upload.
  private readonly ensuredBuckets = new Set<string>();

  constructor(config: ConfigService) {
    this.client = new S3Client({
      endpoint: config.getOrThrow<string>("RUSTFS_ENDPOINT"),
      region: config.getOrThrow<string>("RUSTFS_REGION"),
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.getOrThrow<string>("RUSTFS_ACCESS_KEY"),
        secretAccessKey: config.getOrThrow<string>("RUSTFS_SECRET_KEY"),
      },
    });
  }

  async uploadObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType?: string
  ): Promise<void> {
    await this.ensureBucket(bucket);
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  async getObject(bucket: string, key: string): Promise<StoredObject> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key })
      );
      return {
        body: response.Body as Readable,
        contentType: response.ContentType,
      };
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException(`Object not found: ${key}`);
      }
      throw error;
    }
  }

  // Not called from onModuleInit on purpose: RustFS has no startup
  // healthcheck/depends_on yet, so checking at boot could crash the backend
  // if RustFS isn't up yet. Checking lazily on first upload avoids that.
  private async ensureBucket(bucket: string): Promise<void> {
    if (this.ensuredBuckets.has(bucket)) {
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    this.ensuredBuckets.add(bucket);
  }

  private isNotFoundError(error: unknown): boolean {
    const name = (error as { name?: string } | undefined)?.name;
    const statusCode = (
      error as { $metadata?: { httpStatusCode?: number } } | undefined
    )?.$metadata?.httpStatusCode;
    return name === "NotFound" || name === "NoSuchKey" || statusCode === 404;
  }
}
