import { Injectable, Logger } from '@nestjs/common';
import { UploadDocument } from './UploadDocument';
import { DeleteAttachment } from './DeleteAttachment';
import { GetAttachment } from './GetAttachment';
import { LinkAttachment } from './LinkAttachment';
import { UnlinkAttachment } from './UnlinkAttachment';
import { getAttachmentPresignedUrl } from './GetAttachmentPresignedUrl';
import * as crypto from 'crypto';

@Injectable()
export class AttachmentsApplication {
  private readonly logger = new Logger(AttachmentsApplication.name);

  constructor(
    private readonly uploadDocumentService: UploadDocument,
    private readonly deleteDocumentService: DeleteAttachment,
    private readonly getDocumentService: GetAttachment,
    private readonly linkDocumentService: LinkAttachment,
    private readonly unlinkDocumentService: UnlinkAttachment,
    private readonly getPresignedUrlService: getAttachmentPresignedUrl,
  ) {}

  /**
   * Saves the metadata of uploaded document with enhanced security tracking
   * @param {} file - Validated file with security metadata
   * @returns {Promise<Document>}
   */
  public async upload(file: any) {
    try {
      // Generate secure storage key
      const fileId = (file as any).fileId || crypto.randomUUID();
      const sanitizedFilename = (file as any).sanitizedFilename || file.originalname;
      const storageKey = this.generateSecureStorageKey(fileId, sanitizedFilename);
      
      // Calculate file hash for integrity verification
      const fileHash = (file as any).fileHash || crypto.createHash('sha256').update(file.buffer).digest('hex');
      
      // Enhanced metadata for security tracking
      const enhancedFile = {
        ...file,
        key: storageKey,
        fileId,
        sanitizedFilename,
        fileHash,
        uploadedAt: new Date(),
        validated: true,
      };

      this.logger.log(`Uploading file with secure metadata: ${sanitizedFilename}, hash: ${fileHash.substring(0, 8)}...`);
      
      const result = await this.uploadDocumentService.upload(enhancedFile);
      
      return {
        ...result,
        id: fileId,
        secureHash: fileHash.substring(0, 16), // Partial hash for verification
      };
      
    } catch (error) {
      this.logger.error(`Upload processing failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate secure storage key with proper organization
   */
  private generateSecureStorageKey(fileId: string, filename: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Extract extension safely
    const extension = filename.split('.').pop()?.toLowerCase() || 'unknown';
    
    // Organize files by date for better management and security
    return `uploads/${year}/${month}/${day}/${fileId}.${extension}`;
  }

  /**
   * Deletes the give file attachment file key.
   * @param {string} documentKey
   * @returns {Promise<void>}
   */
  public delete(documentKey: string) {
    return this.deleteDocumentService.delete(documentKey);
  }

  /**
   * Retrieves the document data.
   * @param {string} documentKey
   */
  public get(documentKey: string) {
    return this.getDocumentService.getAttachment(documentKey);
  }

  /**
   * Links the given document to resource model.
   * @param {string} filekey
   * @param {string} modelRef
   * @param {number} modelId
   * @returns
   */
  public link(filekey: string, modelRef: string, modelId: number) {
    return this.linkDocumentService.link(filekey, modelRef, modelId);
  }

  /**
   * Unlinks the given document from resource model.
   * @param {string} filekey
   * @param {string} modelRef
   * @param {number} modelId
   * @returns
   */
  public unlink(filekey: string, modelRef: string, modelId: number) {
    return this.unlinkDocumentService.unlink(filekey, modelRef, modelId);
  }

  /**
   * Retrieves the presigned url of the given attachment key.
   * @param {string} key
   * @returns {Promise<string>}
   */
  public getPresignedUrl(key: string): Promise<string> {
    return this.getPresignedUrlService.getPresignedUrl(key);
  }
}
