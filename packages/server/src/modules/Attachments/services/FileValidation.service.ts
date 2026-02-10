import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileUploadConfig } from '../../../common/config/file-upload';

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);
  
  constructor(private readonly config: FileUploadConfig) {}

  /**
   * Comprehensive file validation including size, type, extension, and content checks
   */
  async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // 1. Validate file size
    this.validateFileSize(file);

    // 2. Validate filename for security issues
    this.validateFileName(file.originalname);

    // 3. Validate file extension
    const extension = this.validateAndGetExtension(file.originalname);

    // 4. Validate MIME type
    this.validateMimeType(file, extension);

    // 5. Perform content-based validation
    if (this.config.enableContentScanning) {
      await this.scanFileContent(file);
    }

    this.logger.log(`File validation passed: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
  }

  /**
   * Validate file size against configured limits
   */
  private validateFileSize(file: Express.Multer.File): void {
    if (file.size <= 0) {
      throw new BadRequestException('File is empty');
    }

    if (file.size > this.config.maxFileSize) {
      throw new BadRequestException(
        `File size ${this.formatBytes(file.size)} exceeds maximum allowed size of ${this.formatBytes(this.config.maxFileSize)}`
      );
    }

    // Check for suspiciously small files that might indicate manipulation
    if (file.size < 10) {
      throw new BadRequestException('File appears to be corrupted or empty');
    }
  }

  /**
   * Validate filename for path traversal and malicious patterns
   */
  private validateFileName(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw new BadRequestException('Filename is required');
    }

    // Check for path traversal attempts
    const pathTraversalPatterns = [
      /\.\./,
      /\.\.%2F/i,
      /\.\.%5C/i,
      /\.\.\/\//,
      /\.\.\\/,
      /%2E%2E/i,
      /\0/
    ];

    for (const pattern of pathTraversalPatterns) {
      if (pattern.test(filename)) {
        throw new BadRequestException('Invalid filename detected');
      }
    }

    // Check for null bytes and control characters
    if (/[\x00-\x1f\x7f-\x9f]/.test(filename)) {
      throw new BadRequestException('Filename contains invalid characters');
    }

    // Check filename length
    if (filename.length > 255) {
      throw new BadRequestException('Filename is too long');
    }

    // Check for reserved Windows names
    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const baseName = path.basename(filename, path.extname(filename)).toUpperCase();
    if (reservedNames.includes(baseName)) {
      throw new BadRequestException('Filename uses reserved name');
    }
  }

  /**
   * Validate file extension and check for double extensions
   */
  private validateAndGetExtension(filename: string): string {
    const extension = path.extname(filename).toLowerCase();
    
    if (!extension) {
      throw new BadRequestException('File must have an extension');
    }

    // Check for double extensions (e.g., .jpg.exe)
    const parts = filename.toLowerCase().split('.');
    if (parts.length > 2) {
      // Check if any intermediate part is a dangerous extension
      for (let i = 1; i < parts.length - 1; i++) {
        const intermediateExt = '.' + parts[i];
        if (this.config.dangerousExtensions.includes(intermediateExt)) {
          throw new BadRequestException('File contains dangerous extension in filename');
        }
      }
    }

    // Check against dangerous extensions blacklist
    if (this.config.dangerousExtensions.includes(extension)) {
      throw new BadRequestException(`File extension ${extension} is not allowed for security reasons`);
    }

    // Check against allowed extensions whitelist
    if (!this.config.allowedExtensions.includes(extension)) {
      throw new BadRequestException(
        `File extension ${extension} is not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`
      );
    }

    return extension;
  }

  /**
   * Validate MIME type against whitelist
   */
  private validateMimeType(file: Express.Multer.File, extension: string): void {
    if (!file.mimetype) {
      throw new BadRequestException('File MIME type is required');
    }

    // Check against allowed MIME types
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`
      );
    }

    // Verify MIME type matches extension expectations
    const expectedMimeTypes = this.getMimeTypesForExtension(extension);
    if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(file.mimetype)) {
      this.logger.warn(`MIME type mismatch: extension ${extension} with MIME type ${file.mimetype}`);
      // Allow the mismatch but log it for monitoring
      // Some files may have generic MIME types like application/octet-stream
    }
  }

  /**
   * Scan file content for malicious patterns
   */
  private async scanFileContent(file: Express.Multer.File): Promise<void> {
    if (!file.buffer) {
      throw new BadRequestException('File content is not available for scanning');
    }

    // Read first 4KB for content analysis
    const sampleSize = Math.min(4096, file.size);
    const contentBuffer = file.buffer.slice(0, sampleSize);
    const contentText = contentBuffer.toString('utf8').toLowerCase();

    // Check for executable file signatures
    const executableSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable (MZ)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
      Buffer.from([0xFE, 0xED, 0xFA]), // Mach-O executable
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class file
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP/JAR (check later for Java archives)
    ];

    for (const signature of executableSignatures) {
      if (contentBuffer.indexOf(signature) === 0) {
        throw new BadRequestException('Executable file detected');
      }
    }

    // Check for script content patterns
    const scriptPatterns = [
      /<\?php/i,
      /<\?=/i,
      /<%[^>]*%>/,
      /<script[\s>]/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i, // Event handlers like onclick=
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /passthru\s*\(/i,
      /shell_exec/i,
      /base64_decode/i,
      /document\.write/i,
      /\.getruntime\(\)/i,
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(contentText)) {
        throw new BadRequestException('Potentially malicious script content detected');
      }
    }

    // Check for common web shell indicators
    const webShellIndicators = [
      /\$_(?:get|post|request|files|server|cookie|session)\s*\[/i,
      /file_get_contents\s*\(/i,
      /file_put_contents\s*\(/i,
      /fwrite\s*\(/i,
      /fopen\s*\(/i,
      /curl_exec\s*\(/i,
    ];

    for (const indicator of webShellIndicators) {
      if (indicator.test(contentText)) {
        throw new BadRequestException('Potential web shell detected');
      }
    }

    // Additional checks for specific file types
    if (file.mimetype.startsWith('image/')) {
      this.validateImageContent(contentBuffer, file.mimetype);
    }

    // Calculate and store file hash for duplicate detection
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
    (file as any).fileHash = fileHash;
  }

  /**
   * Validate image file content
   */
  private validateImageContent(buffer: Buffer, mimeType: string): void {
    // Check for proper image file signatures
    const imageSignatures: Record<string, Buffer[]> = {
      'image/jpeg': [
        Buffer.from([0xFF, 0xD8, 0xFF]),
      ],
      'image/png': [
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      ],
      'image/gif': [
        Buffer.from('GIF87a'),
        Buffer.from('GIF89a'),
      ],
      'image/webp': [
        Buffer.from('RIFF'),
      ],
    };

    const signatures = imageSignatures[mimeType];
    if (signatures) {
      const hasValidSignature = signatures.some(signature => 
        buffer.indexOf(signature) === 0 || 
        (mimeType === 'image/webp' && buffer.indexOf(signature) === 0 && buffer.indexOf(Buffer.from('WEBP')) === 8)
      );

      if (!hasValidSignature) {
        throw new BadRequestException('Invalid image file format');
      }
    }

    // Check for embedded PHP in images
    const imageText = buffer.toString('utf8', 0, Math.min(2048, buffer.length));
    if (/<\?php/i.test(imageText)) {
      throw new BadRequestException('Image file contains embedded script content');
    }
  }

  /**
   * Get expected MIME types for a file extension
   */
  private getMimeTypesForExtension(extension: string): string[] {
    const extensionToMimeTypes: Record<string, string[]> = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.webp': ['image/webp'],
      '.pdf': ['application/pdf'],
      '.txt': ['text/plain'],
      '.csv': ['text/csv', 'text/plain'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.xls': ['application/vnd.ms-excel'],
      '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    };

    return extensionToMimeTypes[extension] || [];
  }

  /**
   * Format bytes for user-friendly display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}