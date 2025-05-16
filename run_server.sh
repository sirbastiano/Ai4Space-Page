#!/bin/bash
# Navigate to the backend directory
cd "$(dirname "$0")/backend"

# Run the Flask application using PDM
echo "Starting Flask server via PDM..."
# Try alternative ports if 5000 is in use (common on macOS due to AirPlay)
PORT=5000
while ! nc -z localhost $PORT 2>/dev/null; do
  echo "Port $PORT is available, using it."
  break
done
if nc -z localhost $PORT 2>/dev/null; then
  PORT=5001
  echo "Port 5000 is in use, trying port $PORT instead."
  if nc -z localhost $PORT 2>/dev/null; then
	PORT=8080
	echo "Port 5001 is also in use, trying port $PORT instead."
  fi
fi
pdm run flask --app app run --debug --host=0.0.0.0 --port=$PORT
