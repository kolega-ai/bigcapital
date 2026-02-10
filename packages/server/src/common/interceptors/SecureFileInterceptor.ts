import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  mixin,
  Type,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import * as multer from 'multer';
import { FileValidationService } from '../../modules/Attachments/services/FileValidation.service';
import { getFileUploadConfig } from '../config/file-upload';

/**
 * Secure file interceptor that provides comprehensive file validation
 * including size limits, file type validation, and content scanning
 */
export function SecureFileInterceptor(fieldName: string = 'file'): Type<NestInterceptor> {
  @Injectable()
  class MixinSecureFileInterceptor implements NestInterceptor {
    private readonly logger = new Logger(MixinSecureFileInterceptor.name);
    private readonly fileValidationService: FileValidationService;
    private readonly multerInstance: any;

    constructor() {
      const config = getFileUploadConfig();
      this.fileValidationService = new FileValidationService(config);

      // Configure multer with security settings
      this.multerInstance = multer({
        storage: multer.memoryStorage(),
        limits: {
          fileSize: config.maxFileSize,
          files: 1, // Only allow single file upload
          fields: 10, // Limit number of fields
          fieldNameSize: 100, // Limit field name size
          fieldSize: 1024 * 1024, // 1MB limit for field values
          parts: 20, // Limit number of parts
        },
        fileFilter: (req: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
          try {
            // Early validation checks
            this.performEarlyValidation(file);
            callback(null, true);
          } catch (error) {
            this.logger.warn(`Early file validation failed: ${error.message}`);
            callback(error as Error, false);
          }
        },
      });
    }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();

      try {
        // Process file upload with multer
        await new Promise<void>((resolve, reject) => {
          this.multerInstance.single(fieldName)(request, response, (error: any) => {
            if (error) {
              this.logger.error(`File upload error: ${error.message}`);
              
              if (error instanceof multer.MulterError) {
                switch (error.code) {
                  case 'LIMIT_FILE_SIZE':
                    return reject(new BadRequestException('File size exceeds maximum allowed limit'));
                  case 'LIMIT_FILE_COUNT':
                    return reject(new BadRequestException('Too many files uploaded'));
                  case 'LIMIT_UNEXPECTED_FILE':
                    return reject(new BadRequestException('Unexpected field name for file upload'));
                  case 'LIMIT_FIELD_COUNT':
                    return reject(new BadRequestException('Too many fields in request'));
                  case 'LIMIT_FIELD_SIZE':
                    return reject(new BadRequestException('Field value too large'));
                  case 'LIMIT_PART_COUNT':
                    return reject(new BadRequestException('Too many parts in multipart request'));
                  default:
                    return reject(new BadRequestException('File upload failed'));
                }
              }
              
              return reject(error);
            }
            resolve();
          });
        });

        // Perform comprehensive file validation
        const file = request.file;
        if (file) {
          await this.fileValidationService.validateFile(file);
          
          // Add security metadata
          file.uploadedAt = new Date();
          file.validated = true;
          
          this.logger.log(`File upload successful: ${file.originalname}`);
        }

      } catch (error) {
        this.logger.error(`File validation failed: ${error.message}`);
        
        // Clean up any uploaded file data
        if (request.file) {
          delete request.file;
        }
        
        throw error;
      }

      return next.handle();
    }

    /**
     * Perform early validation checks during file filter stage
     */
    private performEarlyValidation(file: Express.Multer.File): void {
      const config = getFileUploadConfig();

      // Check file extension immediately
      if (file.originalname) {
        const extension = file.originalname.toLowerCase().split('.').pop();
        if (extension && config.dangerousExtensions.includes(`.${extension}`)) {
          throw new BadRequestException('File type not allowed');
        }
      }

      // Check MIME type immediately
      if (file.mimetype && !config.allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('MIME type not allowed');
      }
    }
  }

  return mixin(MixinSecureFileInterceptor);
}