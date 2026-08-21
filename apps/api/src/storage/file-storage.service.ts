import { Injectable, NotFoundException } from '@nestjs/common';
import { BlobServiceClient } from '@azure/storage-blob';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { access, copyFile, mkdir, unlink } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import { Readable } from 'stream';

type StorageDriver = 'azure' | 'local' | 's3';

type StoreFileInput = {
  contentType: string;
  key: string;
  sourcePath: string;
};

type StoredFileDownload = {
  contentType: string;
  stream: NodeJS.ReadableStream;
};

type WebStreamBody = {
  transformToWebStream: () => ReadableStream<Uint8Array>;
};

@Injectable()
export class FileStorageService {
  private s3Client?: S3Client;
  private azureClient?: BlobServiceClient;

  constructor() {
    this.validateConfiguration();
  }

  async storeFile(input: StoreFileInput) {
    const key = this.normalizeKey(input.key);
    const driver = this.driver();

    if (driver === 's3') {
      await this.s3().send(
        new PutObjectCommand({
          Body: createReadStream(input.sourcePath),
          Bucket: this.requiredEnv('FILE_STORAGE_S3_BUCKET'),
          ContentType: input.contentType,
          Key: key,
        }),
      );
      return this.reference(driver, key);
    }

    if (driver === 'azure') {
      const blob = this.azureContainer().getBlockBlobClient(key);
      await blob.uploadFile(input.sourcePath, {
        blobHTTPHeaders: { blobContentType: input.contentType },
      });
      return this.reference(driver, key);
    }

    const targetPath = this.localPath(key);
    await mkdir(dirname(targetPath), { recursive: true });
    await copyFile(input.sourcePath, targetPath);
    return this.reference(driver, key);
  }

  async openFile(reference: string): Promise<StoredFileDownload> {
    const parsed = this.parseReference(reference);

    if (parsed.driver === 's3') {
      const response = await this.s3().send(
        new GetObjectCommand({
          Bucket: this.requiredEnv('FILE_STORAGE_S3_BUCKET'),
          Key: parsed.key,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException('El archivo no existe en storage.');
      }

      return {
        contentType: response.ContentType ?? 'application/octet-stream',
        stream: this.toReadable(response.Body),
      };
    }

    if (parsed.driver === 'azure') {
      const response = await this.azureContainer()
        .getBlobClient(parsed.key)
        .download();

      if (!response.readableStreamBody) {
        throw new NotFoundException('El archivo no existe en storage.');
      }

      return {
        contentType: response.contentType ?? 'application/octet-stream',
        stream: response.readableStreamBody,
      };
    }

    const path = this.localPath(parsed.key);
    await access(path);

    return {
      contentType: this.contentTypeFromKey(parsed.key),
      stream: createReadStream(path),
    };
  }

  async deleteFile(reference: string) {
    const parsed = this.parseReference(reference);

    if (parsed.driver === 's3') {
      await this.s3().send(
        new DeleteObjectCommand({
          Bucket: this.requiredEnv('FILE_STORAGE_S3_BUCKET'),
          Key: parsed.key,
        }),
      );
      return;
    }

    if (parsed.driver === 'azure') {
      await this.azureContainer().getBlobClient(parsed.key).deleteIfExists();
      return;
    }

    await unlink(this.localPath(parsed.key)).catch((error: unknown) => {
      if (this.isFileNotFoundError(error)) {
        return;
      }

      throw error;
    });
  }

  currentDriver(): StorageDriver {
    return this.driver();
  }

  private azureContainer() {
    const containerName = this.requiredEnv('FILE_STORAGE_AZURE_CONTAINER');

    if (!this.azureClient) {
      this.azureClient = BlobServiceClient.fromConnectionString(
        this.requiredEnv('FILE_STORAGE_AZURE_CONNECTION_STRING'),
      );
    }

    return this.azureClient.getContainerClient(containerName);
  }

  private contentTypeFromKey(key: string) {
    if (key.endsWith('.csv')) return 'text/csv; charset=utf-8';
    return 'application/octet-stream';
  }

  private driver(): StorageDriver {
    const configured = (process.env.FILE_STORAGE_DRIVER ?? 'local').trim();

    if (
      configured === 'local' ||
      configured === 's3' ||
      configured === 'azure'
    ) {
      return configured;
    }

    throw new Error('FILE_STORAGE_DRIVER debe ser local, s3 o azure.');
  }

  private validateConfiguration() {
    const driver = this.driver();

    if (driver === 's3') {
      this.requiredEnv('FILE_STORAGE_S3_BUCKET');
      const endpoint = process.env.FILE_STORAGE_S3_ENDPOINT?.trim();

      if (endpoint) {
        try {
          const parsed = new URL(endpoint);

          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('protocolo no permitido');
          }
        } catch {
          throw new Error('FILE_STORAGE_S3_ENDPOINT no es una URL valida.');
        }
      }
    }

    if (driver === 'azure') {
      this.requiredEnv('FILE_STORAGE_AZURE_CONNECTION_STRING');
      this.requiredEnv('FILE_STORAGE_AZURE_CONTAINER');
    }
  }

  private localPath(value: string) {
    const key = value.startsWith('uploads/')
      ? value.slice('uploads/'.length)
      : value;
    const root = resolve(
      process.cwd(),
      process.env.FILE_STORAGE_LOCAL_ROOT ?? 'uploads',
    );
    const path = resolve(root, key);

    if (!path.startsWith(`${root}${sep}`)) {
      throw new Error('Ruta de archivo no permitida.');
    }

    return path;
  }

  private isFileNotFoundError(error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    const message = error instanceof Error ? error.message : String(error);

    return (
      code === 'ENOENT' ||
      message.includes('ENOENT') ||
      message.includes('no such file or directory')
    );
  }

  private normalizeKey(value: string) {
    const key = value.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!key || key.includes('..')) {
      throw new Error('La ruta de storage no es valida.');
    }

    return key;
  }

  private parseReference(reference: string): {
    driver: StorageDriver;
    key: string;
  } {
    if (reference.startsWith('s3:')) {
      return { driver: 's3', key: this.normalizeKey(reference.slice(3)) };
    }

    if (reference.startsWith('azure:')) {
      return { driver: 'azure', key: this.normalizeKey(reference.slice(6)) };
    }

    if (reference.startsWith('local:')) {
      return {
        driver: 'local',
        key: this.normalizeLocalKey(reference.slice(6)),
      };
    }

    const legacyKey = reference.startsWith('uploads/')
      ? reference.slice('uploads/'.length)
      : reference;

    return { driver: 'local', key: this.normalizeKey(legacyKey) };
  }

  private reference(driver: StorageDriver, key: string) {
    return `${driver}:${key}`;
  }

  private normalizeLocalKey(value: string) {
    const key = this.normalizeKey(value);
    return key.startsWith('uploads/') ? key.slice('uploads/'.length) : key;
  }

  private requiredEnv(name: string) {
    const value = process.env[name]?.trim();

    if (!value) {
      throw new Error(`${name} no esta configurado.`);
    }

    return value;
  }

  private s3() {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        endpoint: process.env.FILE_STORAGE_S3_ENDPOINT,
        forcePathStyle: process.env.FILE_STORAGE_S3_FORCE_PATH_STYLE === 'true',
        region: process.env.FILE_STORAGE_S3_REGION ?? 'auto',
      });
    }

    return this.s3Client;
  }

  private toReadable(body: unknown): NodeJS.ReadableStream {
    if (body instanceof Readable) {
      return body;
    }

    if (this.hasWebStream(body)) {
      const stream = body.transformToWebStream() as unknown as Parameters<
        typeof Readable.fromWeb
      >[0];
      return Readable.fromWeb(stream);
    }

    throw new Error('El storage no devolvio un stream compatible.');
  }

  private hasWebStream(body: unknown): body is WebStreamBody {
    return (
      body !== null &&
      typeof body === 'object' &&
      'transformToWebStream' in body &&
      typeof body.transformToWebStream === 'function'
    );
  }
}
