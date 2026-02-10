import mime from 'mime-types';
import { Response, NextFunction, Request } from 'express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  UploadedFile,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import {
  LinkAttachmentDto,
  UnlinkAttachmentDto,
  UploadAttachmentDto,
} from './dtos/Attachment.dto';
import { AttachmentsApplication } from './AttachmentsApplication';
import { AttachmentUploadPipeline } from './S3UploadPipeline';
import { SecureFileInterceptor } from '@/common/interceptors/SecureFileInterceptor';
import { ConfigService } from '@nestjs/config';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import * as crypto from 'crypto';

@ApiTags('Attachments')
@Controller('/attachments')
@ApiCommonHeaders()
export class AttachmentsController {
  private readonly logger = new Logger(AttachmentsController.name);

  /**
   * @param {AttachmentsApplication} attachmentsApplication - Attachments application.
   * @param uploadPipelineService
   */
  constructor(
    private readonly attachmentsApplication: AttachmentsApplication,
    private readonly uploadPipelineService: AttachmentUploadPipeline,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Uploads the attachments with comprehensive security validation
   */
  @Post()
  @HttpCode(200)
  @UseInterceptors(SecureFileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ 
    summary: 'Upload attachment with security validation',
    description: 'Upload file with comprehensive validation including file type, size, and content scanning'
  })
  @ApiBody({ description: 'Upload attachment', type: UploadAttachmentDto })
  @ApiResponse({
    status: 200,
    description: 'The document has been uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        fileId: { type: 'string' },
        filename: { type: 'string' },
        size: { type: 'number' },
        uploadedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - File validation failed',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Upload processing failed',
  })
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    try {
      // File has already been validated by SecureFileInterceptor
      if (!file) {
        throw new BadRequestException('No file provided or file validation failed');
      }

      // Additional security checks at controller level (defense in depth)
      this.performAdditionalSecurityChecks(file);

      // Generate secure filename and add metadata
      const sanitizedFilename = this.sanitizeFilename(file.originalname);
      const fileId = crypto.randomUUID();
      
      // Add security metadata to file object
      (file as any).sanitizedFilename = sanitizedFilename;
      (file as any).fileId = fileId;
      (file as any).processedAt = new Date();

      this.logger.log(`Processing secure file upload: ${sanitizedFilename} (${file.size} bytes)`);

      const data = await this.attachmentsApplication.upload(file);

      // Return sanitized response without exposing internal details
      return {
        success: true,
        fileId: data.id || fileId,
        filename: sanitizedFilename,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`File upload failed: ${error.message}`, error.stack);

      // Don't expose internal error details to client
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('File upload processing failed');
    }
  }

  /**
   * Additional security checks performed at controller level
   */
  private performAdditionalSecurityChecks(file: Express.Multer.File): void {
    // Check if file was properly validated
    if (!(file as any).validated) {
      throw new BadRequestException('File security validation incomplete');
    }

    // Check for filename injection attempts
    if (file.originalname.includes('../') || file.originalname.includes('..\\')) {
      throw new BadRequestException('Invalid filename pattern detected');
    }

    // Verify file has required metadata
    if (!file.mimetype || !file.size || !file.originalname) {
      throw new BadRequestException('Incomplete file metadata');
    }
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    // Remove path components
    let sanitized = filename.replace(/^.*[\\\/]/, '');
    
    // Replace unsafe characters with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Ensure filename doesn't start with a dot
    if (sanitized.startsWith('.')) {
      sanitized = 'file_' + sanitized;
    }
    
    // Limit length while preserving extension
    if (sanitized.length > 100) {
      const extension = sanitized.split('.').pop() || '';
      const name = sanitized.substring(0, 95 - extension.length);
      sanitized = `${name}.${extension}`;
    }
    
    return sanitized;
  }

  /**
   * Retrieves the given attachment key.
   */
  @Get('/:id')
  @ApiOperation({ summary: 'Get attachment by ID' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({ status: 200, description: 'Returns the attachment file' })
  async getAttachment(
    @Res() res: Response,
    @Param('id') documentId: string,
  ): Promise<Response | void> {
    const data = await this.attachmentsApplication.get(documentId);

    const byte = await data.Body.transformToByteArray();
    const extension = mime.extension(data.ContentType);
    const buffer = Buffer.from(byte);

    res.set('Content-Disposition', `filename="${documentId}.${extension}"`);
    res.set('Content-Type', data.ContentType);
    res.send(buffer);
  }

  /**
   * Deletes the given document key.
   */
  @Delete('/:id')
  @ApiOperation({ summary: 'Delete attachment by ID' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({
    status: 200,
    description: 'The document has been deleted successfully',
  })
  async deleteAttachment(@Param('id') documentId: string) {
    await this.attachmentsApplication.delete(documentId);

    return {
      status: 200,
      message: 'The document has been delete successfully.',
    };
  }

  /**
   * Links the given document key.
   */
  @Post('/:id/link')
  @ApiOperation({ summary: 'Link attachment to a model' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiBody({ type: LinkAttachmentDto })
  @ApiResponse({
    status: 200,
    description: 'The document has been linked successfully',
  })
  async linkDocument(
    @Body() linkDocumentDto: LinkAttachmentDto,
    @Param('id') documentId: string,
  ) {
    await this.attachmentsApplication.link(
      documentId,
      linkDocumentDto.modelRef,
      linkDocumentDto.modelId,
    );

    return {
      status: 200,
      message: 'The document has been linked successfully.',
    };
  }

  /**
   * Links the given document key.
   */
  @Post('/:id/unlink')
  @ApiOperation({ summary: 'Unlink attachment from a model' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiBody({ type: UnlinkAttachmentDto })
  @ApiResponse({
    status: 200,
    description: 'The document has been unlinked successfully',
  })
  async unlinkDocument(
    @Body() unlinkDto: UnlinkAttachmentDto,
    @Param('id') documentId: string,
  ) {
    await this.attachmentsApplication.link(
      documentId,
      unlinkDto.modelRef,
      unlinkDto.modelId,
    );

    return {
      status: 200,
      message: 'The document has been linked successfully.',
    };
  }

  /**
   * Retreives the presigned url of the given attachment key.
   */
  @Get('/:id/presigned-url')
  @ApiOperation({ summary: 'Get presigned URL for attachment' })
  @ApiParam({ name: 'id', description: 'Attachment ID' })
  @ApiResponse({
    status: 200,
    description: 'Returns the presigned URL for the attachment',
  })
  async getAttachmentPresignedUrl(@Param('id') documentKey: string) {
    const presignedUrl =
      await this.attachmentsApplication.getPresignedUrl(documentKey);

    return { presignedUrl };
  }
}
