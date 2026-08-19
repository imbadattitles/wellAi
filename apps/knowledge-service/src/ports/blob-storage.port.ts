export interface StoredDocumentBlob {
  sourceId: string;
  data: Buffer;
  fileName: string;
  mimeType: 'application/pdf';
  sha256: string;
}

export interface PutDocumentBlobInput extends StoredDocumentBlob {}

export interface BlobStoragePort {
  put(input: PutDocumentBlobInput): Promise<void>;
  get(sourceId: string): Promise<StoredDocumentBlob | null>;
}

export const BLOB_STORAGE = Symbol('BLOB_STORAGE');
