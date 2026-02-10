import { registerAs } from '@nestjs/config';

export interface FileUploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  dangerousExtensions: string[];
  enableContentScanning: boolean;
}

export const defaultFileUploadConfig: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB default
  allowedMimeTypes: [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  allowedExtensions: [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',
    '.pdf', '.txt', '.csv', '.doc', '.docx',
    '.xls', '.xlsx'
  ],
  dangerousExtensions: [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
    '.vbs', '.js', '.jar', '.sh', '.app', '.deb', 
    '.rpm', '.msi', '.dll', '.so', '.php', '.jsp',
    '.asp', '.aspx', '.pl', '.py', '.rb'
  ],
  enableContentScanning: true
};

export default registerAs('fileUpload', () => ({
  ...defaultFileUploadConfig,
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760'),
  enableContentScanning: process.env.ENABLE_CONTENT_SCANNING !== 'false'
}));

export function getFileUploadConfig(): FileUploadConfig {
  return {
    ...defaultFileUploadConfig,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760'),
    enableContentScanning: process.env.ENABLE_CONTENT_SCANNING !== 'false'
  };
}