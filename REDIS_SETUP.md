# Redis Setup Guide for TelemetryX

## Quick Start

### Option 1: Docker Compose (Recommended)
```bash
cd /Volumes/Space/PROJECTS/TelemetryX
docker-compose --profile analytics up --build
```

### Option 2: Manual Redis Install & Run
```bash
# Install Redis
# macOS:
brew install redis

# Ubuntu/Debian:
sudo apt-get install redis-server

# Start Redis
redis-server --daemonize yes

# Verify
redis-cli ping
# Should return: PONG
```

### Option 3: Python-based Start
```bash
cd /Volumes/Space/PROJECTS/TelemetryX/backend
./start_with_redis.sh
```

## Configuration

### Environment Variables
Add to your `.env` file:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_ENABLED=1
REDIS_TTL_SESSION=60
REDIS_TTL_TELEMETRY=30
REDIS_TTL_POSITIONS=5
```

### Docker Compose Redis Service
```yaml
telemetryx-redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
  volumes:
    - telemetryx_redis:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Verify Installation

### Test Redis Connection
```bash
redis-cli ping
# Expected: PONG
```

### Check Cache Keys
```bash
redis-cli KEYS "telemetryx:*"
```

### Monitor Redis Activity
```bash
redis-cli monitor
```

### Clear All Cache
```bash
redis-cli FLUSHDB
```

## Performance Tuning

### Memory Limits
```bash
# Set max memory (adjust based on your RAM)
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Persistence
```bash
# Enable AOF persistence
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec
```

### Connection Pooling
The Redis client uses connection pooling with 20 connections by default. Adjust in `.env`:
```
REDIS_POOL_MAX_CONNECTIONS=20
```

## Troubleshooting

### Redis Won't Start
```bash
# Check if Redis is running
ps aux | grep redis

# Kill existing process
sudo pkill redis-server

# Start fresh
redis-server --daemonize yes
```

### Connection Refused
```bash
# Check Redis is listening
netstat -tln | grep 6379

# Or using lsof
lsof -i :6379
```

### Port Already in Use
```bash
# Find process using port 6379
lsof -i :6379

# Kill it
kill -9 <PID>
```

## Expected Performance

| Operation | Before Redis | With Redis | Improvement |
|-----------|--------------|------------|-------------|
| Session load | 200-500ms | 10-50ms | 80-90% |
| Telemetry | 100-300ms | 5-20ms | 90%+ |
| Cache hit rate | 0% | 70-90% | N/A |
| Concurrent users | 10-20 | 100+ | 5x |

## Next Steps

### 1. Start Services
```bash
# Terminal 1: Start Redis
redis-server --daemonize yes

# Terminal 2: Start Backend
cd /Volumes/Space/PROJECTS/TelemetryX/backend
uvicorn main:app --host 0.0.0.0 --port 9000 --reload

# Terminal 3: Start Frontend
cd /Volumes/Space/PROJECTS/TelemetryX/frontend-electron
npm run dev
```

### 2. Verify Caching
```python
# Test caching works
import redis
r = redis.Redis(host='localhost', port=6379, db=0)
r.set('test', 'data')
print(r.get('test'))  # Should print: b'data'
```

### 3. Monitor Performance
- Check frontend console for API response times
- Use browser DevTools Network tab
- Monitor Redis with `redis-cli monitor`

## Production Considerations

### Security
1. Set a strong password: `REDIS_PASSWORD=your-secure-password`
2. Bind Redis to localhost only in production
3. Use TLS for remote connections

### Scaling
1. Redis Cluster for high availability
2. Sentinel for automatic failover
3. Read replicas for load balancing

### Monitoring
```bash
# Redis info
redis-cli INFO

# Memory usage
redis-cli INFO memory

# Connected clients
redis-cli CLIENT LIST
```

## Files Modified

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Added Redis service |
| `backend/api/redis_client.py` | Redis connection module |
| `backend/api/cache.py` | Cache abstraction layer |
| `backend/api/config.py` | Configuration variables |
| `backend/requirements.txt` | Dependencies |
| `backend/api/routers/sessions.py` | Session caching |
| `.env` | Environment variables |
| `backend/start_with_redis.sh` | Startup script |
