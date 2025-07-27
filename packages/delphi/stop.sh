#!/bin/bash

# Delphi Automated Dev Pipeline - Stop Script
# This script stops all Delphi services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 Stopping Delphi Automated Dev Pipeline${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Stop AutoGen service
if [ -f .autogen.pid ]; then
    AUTOGEN_PID=$(cat .autogen.pid)
    if kill -0 $AUTOGEN_PID 2>/dev/null; then
        echo -e "${YELLOW}🤖 Stopping AutoGen service (PID: $AUTOGEN_PID)...${NC}"
        kill $AUTOGEN_PID
        echo -e "${GREEN}✅ AutoGen service stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  AutoGen service not running${NC}"
    fi
    rm -f .autogen.pid
else
    # Try to find and kill by process name
    if pkill -f "autogen_service.py" 2>/dev/null; then
        echo -e "${GREEN}✅ AutoGen service stopped${NC}"
    else
        echo -e "${YELLOW}⚠️  AutoGen service not found${NC}"
    fi
fi

# Clean up any lingering processes on the ports
echo -e "\n${YELLOW}🧹 Cleaning up ports...${NC}"

# Kill processes on port 8100 (AutoGen)
if lsof -ti:8100 >/dev/null 2>&1; then
    lsof -ti:8100 | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Cleaned port 8100${NC}"
fi

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Delphi services stopped${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"