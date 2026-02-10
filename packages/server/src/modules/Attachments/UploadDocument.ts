import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenancyDatabaseModule } from '../Tenancy/TenancyDB/TenancyDB.module';
import { TenantModelProxy } from '../System/models/TenantBaseModel';
import { DocumentModel } from './models/Document.model';

@Injectable()
export class UploadDocument {
  private readonly logger = new Logger(UploadDocument.name);

  constructor(
    @Inject(DocumentModel.name)
    private readonly documentModel: TenantModelProxy<typeof DocumentModel>,
  ) {}

  /**
   * Inserts the document metadata with enhanced security tracking.
   * @param {} file - Enhanced file object with security metadata
   * @returns {}
   */
  async upload(file: any) {
    try {
      const insertedDocument = await this.documentModel().query().insert({
        key: file.key,
        mimeType: file.mimetype,
        size: file.size,
        originName: file.originalname,
        // Enhanced security metadata
        sanitizedName: file.sanitizedFilename || file.originalname,
        fileHash: file.fileHash,
        uploadedAt: file.uploadedAt || new Date(),
        validated: file.validated || false,
        fileId: file.fileId,
      });

      this.logger.log(`Document metadata stored: ${file.key}`);
      return insertedDocument;
      
    } catch (error) {
      this.logger.error(`Failed to store document metadata: ${error.message}`, error.stack);
      throw error;
    }
  }
}
