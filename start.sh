#!/bin/bash
set -e

# TelemetryX One-Command Setup
# Usage: ./start.sh

echo "🚀 Starting TelemetryX..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python version
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
        PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info[0])')
        PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info[1])')
        
        if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 11 ]; then
            echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION found"
            return 0
        else
            echo -e "${RED}✗${NC} Python 3.11+ required, found $PYTHON_VERSION"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} Python 3.11+ not found"
        return 1
    fi
}

# Check Node.js version
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            echo -e "${GREEN}✓${NC} Node.js $(node -v) found"
            return 0
        else
            echo -e "${RED}✗${NC} Node.js 20+ required, found $(node -v)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} Node.js 20+ not found"
        return 1
    fi
}

# Check prerequisites
echo "Checking prerequisites..."
check_python
check_node

# Setup backend
echo "Setting up backend..."
cd "$(dirname "$0")"

if [ ! -d "backend/.venv" ]; then
    echo "Creating Python virtual environment..."
    cd backend
    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt --quiet
    cd ..
else
    echo "Using existing Python virtual environment"
fi

# Setup frontend
echo "Setting up frontend..."
cd frontend-electron
if [ ! -d "node_modules" ]; then
    npm install --silent
fi
cd ..

# Copy .env if not exists
if [ ! -f ".env" ]; then
    echo "Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    fi
fi

# Start backend in background
echo "Starting FastAPI backend on port 9000..."
cd backend
source .venv/bin/activate
# Default local mode is NO DOCKER:
# - DuckDB data source
# - Redis disabled (optional for local users)
# - Auth off for local demo/dev
export REDIS_ENABLED="${REDIS_ENABLED:-0}"
export TELEMETRYX_REQUIRE_AUTH="${TELEMETRYX_REQUIRE_AUTH:-0}"
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Check if backend is running
if ! curl -s http://localhost:9000/health &> /dev/null; then
    echo -e "${YELLOW}⚠${NC} Backend may need a moment to start..."
    sleep 2
fi

# Start web frontend
echo "Starting web frontend..."
cd frontend-electron
npm run dev -- --host 127.0.0.1 --port 5173 &
ELECTRON_PID=$!
cd ..

# Cleanup function
cleanup() {
    echo ""
    echo "Shutting down TelemetryX..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$ELECTRON_PID" ]; then
        kill $ELECTRON_PID 2>/dev/null || true
    fi
    echo "Goodbye! 👋"
}

# Set trap for Ctrl+C
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${GREEN}🎉 TelemetryX is running!${NC}"
echo "   - Backend: http://localhost:9000"
echo "   - Frontend: http://127.0.0.1:5173"
echo ""
echo "Press Ctrl+C to stop"

# Wait for any process to exit
wait
