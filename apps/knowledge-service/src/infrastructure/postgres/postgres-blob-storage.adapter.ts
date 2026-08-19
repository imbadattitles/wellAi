import { Pool } from 'pg';
import { KnowledgeError } from '../../domain/errors';
import {
  BlobStoragePort,
  PutDocumentBlobInput,
  StoredDocumentBlob,
} from '../../ports/blob-storage.port';

interface BlobRow {
  source_id: string;
  content: Buffer;
  file_name: string;
  mime_type: 'application/pdf';
  sha256: string;
}

export class PostgresBlobStorageAdapter implements BlobStoragePort {
  constructor(private readonly pool: Pool) {}

  async put(input: PutDocumentBlobInput): Promise<void> {
    const result = await this.pool.query(
      `INSERT INTO knowledge.document_blobs
        (source_id, file_name, mime_type, sha256, size_bytes, content)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_id) DO UPDATE
         SET file_name = EXCLUDED.file_name,
             mime_type = EXCLUDED.mime_type,
             size_bytes = EXCLUDED.size_bytes,
             content = EXCLUDED.content
       WHERE knowledge.document_blobs.sha256 = EXCLUDED.sha256
       RETURNING source_id`,
      [input.sourceId, input.fileName, input.mimeType, input.sha256, input.data.length, input.data],
    );

    if (result.rowCount === 0) {
      throw new KnowledgeError(
        'DOCUMENT_BLOB_CONFLICT',
        'This sourceId is already associated with a different PDF',
        409,
      );
    }
  }

  async get(sourceId: string): Promise<StoredDocumentBlob | null> {
    const result = await this.pool.query<BlobRow>(
      `SELECT source_id, content, file_name, mime_type, sha256
         FROM knowledge.document_blobs
        WHERE source_id = $1`,
      [sourceId],
    );
    const row = result.rows[0];
    if (!row) return null;

    return {
      sourceId: row.source_id,
      data: row.content,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sha256: row.sha256,
    };
  }
}
