import { FileStorageService } from './file-storage.service';

describe('FileStorageService configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts local storage without external credentials', () => {
    process.env.FILE_STORAGE_DRIVER = 'local';

    expect(() => new FileStorageService()).not.toThrow();
  });

  it('rejects an unknown storage driver', () => {
    process.env.FILE_STORAGE_DRIVER = 'ftp';

    expect(() => new FileStorageService()).toThrow(
      'FILE_STORAGE_DRIVER debe ser local, s3 o azure.',
    );
  });

  it('rejects S3 without a bucket', () => {
    process.env.FILE_STORAGE_DRIVER = 's3';
    delete process.env.FILE_STORAGE_S3_BUCKET;

    expect(() => new FileStorageService()).toThrow(
      'FILE_STORAGE_S3_BUCKET no esta configurado.',
    );
  });

  it('rejects a malformed S3 endpoint', () => {
    process.env.FILE_STORAGE_DRIVER = 's3';
    process.env.FILE_STORAGE_S3_BUCKET = 'spulso';
    process.env.FILE_STORAGE_S3_ENDPOINT = 'https://<account>.example.com';

    expect(() => new FileStorageService()).toThrow(
      'FILE_STORAGE_S3_ENDPOINT no es una URL valida.',
    );
  });
});
