# Redis Security Configuration

This document outlines the Redis security implementation and configuration requirements for the Bigcapital application.

## Security Overview

The Redis configuration has been hardened to address **CWE-306: Missing Authentication for Critical Function**. The implementation enforces secure defaults and validates configuration at application startup.

## Security Features

### 1. **Mandatory Authentication in Production**
- Redis password authentication is **required** in production environments
- Password must be at least 16 characters long in production
- Development environments can run without authentication for convenience

### 2. **Startup Validation**
- Application validates Redis connectivity at startup
- Authentication is verified before accepting requests  
- **Fail-fast behavior** in production - app exits if Redis is misconfigured
- Non-production environments show warnings but continue running

### 3. **Enhanced Configuration Validation**
- Port range validation (1-65535)
- Database number validation (0-15)
- Connection timeout and retry configuration
- TLS/SSL support for encrypted connections

### 4. **Health Monitoring**
- Health check endpoints at `/health` and `/health/redis`
- Real-time Redis connection status monitoring
- Performance metrics and memory usage tracking

## Environment Configuration

### Required Environment Variables

```bash
# Redis Security Configuration
REDIS_HOST=localhost                    # Redis server hostname
REDIS_PORT=6379                        # Redis server port  
REDIS_PASSWORD=                         # REQUIRED in production (16+ chars)
REDIS_DB=0                             # Database number (0-15)

# Optional Security Settings
REDIS_TLS_ENABLED=false                # Enable TLS/SSL encryption
REDIS_CONNECT_TIMEOUT=10000            # Connection timeout (ms)
REDIS_MAX_RETRIES=3                    # Max retry attempts

# Environment Detection
NODE_ENV=development                    # CRITICAL: Set to 'production' in prod
```

### Password Generation

Generate a secure Redis password:

```bash
# Generate a 32-character base64 password
openssl rand -base64 32

# Generate a 40-character hex password  
openssl rand -hex 20
```

## Production Deployment

### 1. **Environment Setup**
```bash
# REQUIRED: Set environment to production
NODE_ENV=production

# REQUIRED: Set a strong Redis password
REDIS_PASSWORD=your_secure_password_here_32_chars_min

# RECOMMENDED: Enable TLS for network security
REDIS_TLS_ENABLED=true
```

### 2. **Redis Server Configuration**
Configure your Redis server with authentication:

```bash
# redis.conf
requirepass your_secure_password_here_32_chars_min
```

### 3. **Docker Configuration**
Production Docker Compose configuration with Redis authentication:

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Security Validation

### Startup Validation Process
1. **Connection Test**: Verify Redis server connectivity
2. **Authentication Test**: Validate password authentication  
3. **Operations Test**: Test read/write operations
4. **Environment Check**: Verify production security requirements

### Production Validation Failures
The application will **terminate immediately** if any of these conditions are met in production:

- `NODE_ENV=production` and `REDIS_PASSWORD` is not set
- `REDIS_PASSWORD` is less than 16 characters in production
- Redis connection fails or times out
- Redis authentication fails
- Redis read/write operations fail

## Monitoring and Health Checks

### Health Check Endpoints

```bash
# Overall system health
GET /health

# Redis-specific health  
GET /health/redis
```

### Sample Health Response
```json
{
  "service": "Redis",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "healthy",
  "details": {
    "responseTime": "5ms",
    "memory": {
      "used_memory": "1024000",
      "used_memory_human": "1.00M"
    },
    "connected": true,
    "host": "redis-server",
    "port": 6379,
    "db": 0
  }
}
```

## Security Best Practices

### 1. **Network Security**
- Use private networks for Redis communication
- Enable TLS/SSL encryption for data in transit
- Implement firewall rules to restrict Redis port access
- Use Redis AUTH even on private networks

### 2. **Access Control**
- Use dedicated Redis users with minimal privileges (Redis 6+)
- Implement ACLs (Access Control Lists) for fine-grained permissions
- Rotate Redis passwords regularly
- Monitor Redis access logs

### 3. **Configuration Security**  
- Disable dangerous Redis commands in production
- Set memory limits to prevent denial of service
- Enable append-only file (AOF) for data persistence
- Configure proper backup and recovery procedures

### 4. **Monitoring and Alerting**
- Monitor Redis connection health
- Set up alerts for authentication failures
- Track Redis memory usage and performance
- Log security-related events

## Troubleshooting

### Common Issues

**Authentication Failed**
```
Error: Redis authentication failed. Please check your REDIS_PASSWORD configuration.
```
Solution: Verify `REDIS_PASSWORD` matches your Redis server password

**Connection Timeout**  
```
Error: Redis connection timeout after 5 seconds
```
Solution: Check Redis server status and network connectivity

**Production Startup Failure**
```
Error: REDIS_PASSWORD is required in production environments
```  
Solution: Set a secure password in production environment

### Debug Mode

Enable detailed Redis logging by setting log level:
```bash
LOG_LEVEL=debug
```

## Security Compliance

This Redis configuration addresses:

- **CWE-306**: Missing Authentication for Critical Function
- **OWASP A07**: Identification and Authentication Failures  
- **PCI DSS**: Network security and access control requirements
- **GDPR**: Data protection through encryption and access controls

## Migration Guide

### Upgrading Existing Deployments

1. **Set Environment Variables**:
   ```bash
   # Add to your .env file
   NODE_ENV=production
   REDIS_PASSWORD=your_secure_password_here
   ```

2. **Update Redis Server Configuration**:
   ```bash
   # Add to redis.conf
   requirepass your_secure_password_here
   ```

3. **Restart Services**:
   ```bash
   docker-compose restart redis
   docker-compose restart app
   ```

4. **Verify Health**:
   ```bash
   curl http://localhost:3000/health/redis
   ```

For assistance with Redis security configuration, please refer to the application logs or contact the development team.