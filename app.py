from flask import Flask, send_from_directory, jsonify
import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Data for the AI4Space Workshop (Tracks and Challenges)
ai4space_content = [
    {
        "id": "track1",
        "type": "Track",
        "title": "🚀 Autonomous Frontiers: Charting the Course for Self-Reliant Space Exploration",
        "description": "Dive into the future of space missions! This track uncovers AI breakthroughs enabling spacecraft, rovers, and robots to think, act, and explore independently. From intelligent pathfinding on distant planets to self-diagnosing critical systems, discover how AI is making a new era of cosmic discovery possible.",
        "lead": "Dr. Astro Innovate",
        "keywords": ["autonomous systems", "space robotics", "AI mission control", "deep space navigation"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1",
        "detailsLink": "/track/track1"
    },
    {
        "id": "track2",
        "type": "Track",
        "title": "🛰️ Earth's Digital Twin: AI for Unprecedented Planetary Insights",
        "description": "Witness how AI is transforming our understanding of Earth from orbit. This track showcases advanced machine learning for analyzing vast streams of satellite data, tackling global challenges like climate change, predicting natural disasters, and fostering sustainable development through intelligent Earth observation.",
        "lead": "Prof. GeoSpatia AI",
        "keywords": ["satellite intelligence", "geospatial AI", "climate modeling", "remote sensing breakthroughs"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1",
        "detailsLink": "/track/track2"
    },
    {
        "id": "challenge1",
        "type": "Challenge",
        "title": "👽 Martian Enigma: The Great Red Planet Anomaly Hunt",
        "description": "Join the quest! Develop a pioneering AI model to sift through Martian landscapes and pinpoint unusual geological formations or even potential biosignatures. We provide the data, you bring the ingenuity. Uncover Mars' secrets!",
        "detailsLink": "/challenge-mars-details",
        "keywords": ["Mars anomaly detection", "astrobiology AI", "planetary image analysis", "NeurIPS Grand Challenge"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"
    },
    {
        "id": "challenge2",
        "type": "Challenge",
        "title": "☀️ Cosmic Forecast: Predicting Solar Storms with AI Precision",
        "description": "Protect our future in space! Craft an AI model to predict the intensity and timing of solar flares. Your work can safeguard vital satellite infrastructure and astronaut missions. Harness the data, tame the sun!",
        "detailsLink": "/challenge-solar-flare-details",
        "keywords": ["solar flare prediction", "space weather AI", "astrophysical forecasting", "critical infrastructure protection"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"
    }
]

organizing_committee_data = [
    {"name": "Dr. Evelyn Reed", "affiliation": "Cosmic AI Institute", "role": "General Chair", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"},
    {"name": "Professor Kenji Tanaka", "affiliation": "Planetary Robotics Lab", "role": "Program Chair", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"},
    {"name": "Dr. Aisha Khan", "affiliation": "Stellar Data Science Group", "role": "Challenges Chair", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"},
    {"name": "Dr. Ben Carter", "affiliation": "AstroInformatics Corp.", "role": "Industry Liaison", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"}
]

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/ai4space-content')
def get_ai4space_content():
    return jsonify(ai4space_content)

@app.route('/track/<track_id>')
def serve_track_detail_page(track_id):
    # Serves the HTML template for a track detail page.
    # The actual data will be fetched by the frontend Vue app.
    return send_from_directory(app.static_folder, 'track_detail.html')

@app.route('/api/tracks/<track_id>')
def get_track_details(track_id):
    track = next((item for item in ai4space_content if item.get('type') == 'Track' and item.get('id') == track_id), None)
    if track:
        return jsonify(track)
    return jsonify({"error": "Track not found"}), 404

@app.route('/committee')
def serve_committee_page():
    return send_from_directory(app.static_folder, 'committee.html')

@app.route('/api/committee')
def get_committee_data():
    return jsonify(organizing_committee_data)

if __name__ == '__main__':
    app.run(debug=True)
