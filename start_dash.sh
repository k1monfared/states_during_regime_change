#!/usr/bin/env bash
# start_dash.sh — kill any existing docs server, start a fresh one, open the dashboard

PORT=8731
DIR="$(cd "$(dirname "$0")" && pwd)/docs"

# Kill any process already using the port
if lsof -ti tcp:$PORT &>/dev/null; then
  echo "Killing existing server on port $PORT..."
  lsof -ti tcp:$PORT | xargs kill -9
fi

# Start server in background
echo "Starting server: http://localhost:$PORT"
python3 -m http.server $PORT --directory "$DIR" &>/dev/null &
echo $! > /tmp/dash_server.pid

# Brief pause for server to be ready
sleep 0.3

# Open browser (works on Linux with X, macOS, and WSL)
URL="http://localhost:$PORT/index.html"
if command -v xdg-open &>/dev/null; then
  xdg-open "$URL"
elif command -v open &>/dev/null; then
  open "$URL"
elif command -v wslview &>/dev/null; then
  wslview "$URL"
else
  echo "Open manually: $URL"
fi

echo "Dashboard running at $URL (PID $(cat /tmp/dash_server.pid))"
echo "Run 'kill \$(cat /tmp/dash_server.pid)' to stop."
