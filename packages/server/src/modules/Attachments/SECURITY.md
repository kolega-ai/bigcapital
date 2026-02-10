# File Upload Security Implementation

## Overview

This document describes the comprehensive security measures implemented for file uploads in the Attachments module to address the security vulnerability identified in the original code.

## Security Vulnerabilities Addressed

### Original Issues
1. **Missing File Type Validation**: No MIME type or extension validation
2. **No File Size Limits**: Could lead to DoS attacks via large files
3. **No Content Validation**: Malicious files could be uploaded without detection
4. **Path Traversal Vulnerability**: Filenames not sanitized
5. **Executable File Uploads**: No prevention of dangerous file types

## Security Implementation

### 1. Multi-Layer Defense Architecture

```
Request → SecureFileInterceptor → Controller Validation → Application Logic → Database
           ↓                      ↓                      ↓
       Early Validation        Defense in Depth      Secure Metadata
       - Size Limits          - Additional Checks    - File Hashing
       - MIME Validation      - Filename Sanitization - Audit Trail
       - Extension Check      - Security Metadata
```

### 2. File Validation Service (`FileValidation.service.ts`)

#### Comprehensive Validation Checks:
- **File Size Validation**: Configurable size limits with DoS protection
- **Filename Security**: Path traversal prevention, reserved name blocking
- **Extension Validation**: Whitelist of allowed extensions, blacklist of dangerous types
- **MIME Type Validation**: Content-type verification with spoofing detection
- **Content Scanning**: Binary signature analysis, script pattern detection
- **Image Validation**: Proper format verification, embedded script detection

#### Security Patterns Detected:
```typescript
// Script Injection Patterns
/<\?php/i, /<script[\s>]/i, /eval\s*\(/i

// Web Shell Indicators  
/\$_(?:get|post|request)\s*\[/i, /file_get_contents\s*\(/i

// Executable Signatures
[0x4D, 0x5A] // PE executable (MZ header)
[0x7F, 0x45, 0x4C, 0x46] // ELF executable
```

### 3. Secure File Interceptor (`SecureFileInterceptor.ts`)

#### Features:
- **Memory-Based Storage**: Prevents temporary file vulnerabilities
- **Strict Limits**: File size, field count, and part count restrictions
- **Early Rejection**: Immediate blocking of dangerous file types
- **Comprehensive Error Handling**: Secure error messages without information leakage

#### Configuration:
```typescript
limits: {
  fileSize: config.maxFileSize,     // 10MB default
  files: 1,                         // Single file only
  fields: 10,                       // Limited form fields
  fieldNameSize: 100,               // Field name size limit
  fieldSize: 1024 * 1024,          // 1MB field value limit
  parts: 20                         // Limited multipart sections
}
```

### 4. Configuration-Driven Security (`file-upload.ts`)

#### Allowed File Types (Whitelist):
- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX, XLS, XLSX
- **Text**: TXT, CSV

#### Blocked Extensions (Blacklist):
- **Executables**: .exe, .bat, .cmd, .com, .msi
- **Scripts**: .js, .php, .py, .sh, .vbs, .asp
- **System Files**: .dll, .so, .deb, .rpm

#### Environment Variables:
```bash
MAX_FILE_SIZE_BYTES=10485760          # 10MB default
ENABLE_CONTENT_SCANNING=true          # Enable content analysis
```

### 5. Enhanced Controller Security (`Attachments.controller.ts`)

#### Security Features:
- **Defense in Depth**: Additional validation beyond interceptor
- **Filename Sanitization**: Safe character replacement
- **Audit Logging**: Comprehensive upload tracking  
- **Secure Response**: No internal detail exposure
- **Error Handling**: Proper exception management

#### Sanitization Process:
```typescript
// Remove path components
filename = filename.replace(/^.*[\\\/]/, '');

// Replace unsafe characters  
filename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');

// Length limiting with extension preservation
if (filename.length > 100) {
  // Truncate while keeping extension
}
```

### 6. Secure Metadata Storage

#### Enhanced Database Fields:
```typescript
{
  key: string,              // Secure storage path
  fileId: string,           // UUID identifier
  sanitizedName: string,    // Safe filename
  fileHash: string,         // SHA-256 hash for integrity
  validated: boolean,       // Security validation status  
  uploadedAt: Date,         // Timestamp for audit
  size: number,             // File size
  mimeType: string          // Validated MIME type
}
```

## Attack Vectors Mitigated

### 1. Malicious File Upload
- **Protection**: Extension whitelist + content scanning
- **Detection**: Binary signature analysis, script pattern matching

### 2. Path Traversal
- **Protection**: Filename sanitization, path component removal
- **Patterns Blocked**: `../`, `..\\`, `%2E%2E`, null bytes

### 3. MIME Type Spoofing
- **Protection**: Content-based type detection
- **Verification**: Binary signature validation for images

### 4. Denial of Service
- **Protection**: File size limits, request limiting
- **Monitoring**: Upload rate and size tracking

### 5. Code Execution
- **Protection**: Extension blacklist, content scanning
- **Detection**: PHP tags, script elements, eval patterns

### 6. Web Shell Upload
- **Protection**: PHP/ASP/JSP pattern detection
- **Indicators**: `$_GET`, `file_get_contents`, `exec` patterns

## Security Best Practices Implemented

### 1. Defense in Depth
- Multiple validation layers at different stages
- Redundant security checks for critical validations

### 2. Fail Secure
- Default deny for unknown file types
- Conservative validation approach

### 3. Least Privilege
- Minimal file permissions and access
- Restricted file type allowlist

### 4. Security Logging
- Comprehensive audit trail
- Failed upload attempt tracking

### 5. Error Handling
- No sensitive information in error messages
- Consistent error responses

## Configuration Guidelines

### Production Security Settings
```typescript
{
  maxFileSize: 5 * 1024 * 1024,      // 5MB for production
  enableContentScanning: true,        // Always enabled
  allowedMimeTypes: [/* minimal set */], // Only required types
  allowedExtensions: [/* minimal set */] // Only required extensions
}
```

### Monitoring and Alerting
- Failed upload attempts (potential attacks)
- Large file uploads (DoS attempts)  
- Blocked file types (security events)
- Content scanning hits (malware detection)

## Testing the Security Implementation

### Valid File Uploads
```bash
# Should succeed
curl -F "file=@test.pdf" http://localhost:3000/attachments
curl -F "file=@image.jpg" http://localhost:3000/attachments
```

### Attack Simulation Tests
```bash  
# Should be blocked - executable
curl -F "file=@malware.exe" http://localhost:3000/attachments

# Should be blocked - script
curl -F "file=@webshell.php" http://localhost:3000/attachments

# Should be blocked - path traversal
curl -F "file=@../../../etc/passwd" http://localhost:3000/attachments

# Should be blocked - large file
dd if=/dev/zero of=large.txt bs=1M count=50
curl -F "file=@large.txt" http://localhost:3000/attachments
```

## Compliance and Standards

This implementation addresses security requirements from:
- **OWASP Top 10**: A01 (Broken Access Control), A03 (Injection)
- **NIST Cybersecurity Framework**: Protect function
- **CWE-434**: Unrestricted Upload of File with Dangerous Type
- **CWE-22**: Path Traversal
- **CWE-434**: File Upload vulnerability

## Future Enhancements

### Phase 2 Security Features
1. **Virus Scanning Integration**: ClamAV or cloud AV services
2. **Machine Learning Detection**: AI-based malware classification  
3. **Behavioral Analysis**: File access pattern monitoring
4. **Quarantine System**: Isolated suspicious file storage
5. **Content Disarm**: Document sanitization and reconstruction

### Advanced Monitoring
1. **Security Analytics**: Upload pattern analysis
2. **Threat Intelligence**: Known malicious hash detection
3. **User Behavior**: Anomalous upload detection  
4. **Incident Response**: Automated threat containment

This comprehensive security implementation transforms the vulnerable file upload endpoint into a robust, secure system that protects against multiple attack vectors while maintaining usability and performance.