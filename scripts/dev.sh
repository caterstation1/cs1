#!/bin/bash

# Development server management script
# This script handles common Next.js development issues

echo "🚀 CaterStation Development Server Manager"
echo "=========================================="

# Function to kill processes on port 3000
kill_port_3000() {
    echo "🔍 Checking for processes on port 3000..."
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "⚠️  Found processes on port 3000. Killing them..."
        lsof -ti:3000 | xargs kill -9
        echo "✅ Killed processes on port 3000"
    else
        echo "✅ Port 3000 is clear"
    fi
}

# Function to clear build cache
clear_cache() {
    echo "🧹 Clearing Next.js build cache..."
    if [ -d ".next" ]; then
        rm -rf .next
        echo "✅ Cleared .next directory"
    else
        echo "✅ No .next directory found"
    fi
}

# Function to check for common issues
check_issues() {
    echo "🔍 Checking for common issues..."
    
    # Check for port conflicts
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "⚠️  Port 3000 is in use"
        return 1
    fi
    
    # Check for corrupted build cache
    if [ -d ".next" ] && [ ! -f ".next/BUILD_ID" ]; then
        echo "⚠️  Build cache may be corrupted"
        return 1
    fi
    
    echo "✅ No issues detected"
    return 0
}

# Function to start development server
start_dev() {
    echo "🚀 Starting development server..."
    npm run dev
}

# Main script logic
case "${1:-start}" in
    "start")
        echo "Starting development server with automatic issue resolution..."
        kill_port_3000
        clear_cache
        start_dev
        ;;
    "clean")
        echo "Cleaning up development environment..."
        kill_port_3000
        clear_cache
        echo "✅ Cleanup complete"
        ;;
    "check")
        check_issues
        ;;
    "kill")
        kill_port_3000
        ;;
    "cache")
        clear_cache
        ;;
    *)
        echo "Usage: $0 [start|clean|check|kill|cache]"
        echo ""
        echo "Commands:"
        echo "  start  - Start dev server with automatic cleanup (default)"
        echo "  clean  - Clean up environment (kill processes, clear cache)"
        echo "  check  - Check for common issues"
        echo "  kill   - Kill processes on port 3000"
        echo "  cache  - Clear build cache"
        exit 1
        ;;
esac 