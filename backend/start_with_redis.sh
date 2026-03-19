#!/bin/bash
# Start TelemetryX backend with Redis caching layer

set -e

echo "Starting TelemetryX Backend with Redis..."
echo "=========================================="

# Check if Redis is installed
if ! command -v redis-server &> /dev/null; then
    echo "Installing Redis..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install redis
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y redis-server
    fi
fi

# Start Redis in background
echo "Starting Redis server on port 6379..."
redis-server --daemonize yes --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru

# Wait for Redis to start
sleep 2

# Verify Redis is running
if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is running"
else
    echo "✗ Redis failed to start"
    exit 1
fi

# Start the backend server
echo ""
echo "Starting FastAPI backend on port 9000..."
cd /Volumes/Space/PROJECTS/TelemetryX/backend
uvicorn main:app --host 0.0.0.0 --port 9000 --reload &
BACKEND_PID=$!

echo "✓ Backend started with PID $BACKEND_PID"
echo ""
echo "Access the API at: http://localhost:9000"
echo "Redis CLI: redis-cli"
echo ""
echo "Press Ctrl+C to stop both services"
echo "=========================================="

# Wait for user to stop
wait $BACKEND_PID

# Cleanup
echo ""
echo "Stopping Redis..."
redis-cli shutdown
