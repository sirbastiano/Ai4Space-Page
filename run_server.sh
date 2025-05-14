#!/bin/bash
# Navigate to the backend directory
cd "$(dirname "$0")/backend"

# Run the Flask application using PDM
echo "Starting Flask server via PDM..."
pdm run flask --app app run --debug --host=0.0.0.0 --port=5000
