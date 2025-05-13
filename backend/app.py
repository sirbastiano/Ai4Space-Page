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
        "detailsLink": "/challenge/challenge1",
        "keywords": ["Mars anomaly detection", "astrobiology AI", "planetary image analysis", "NeurIPS Grand Challenge"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"
    },
    {
        "id": "challenge2",
        "type": "Challenge",
        "title": "☀️ Cosmic Forecast: Predicting Solar Storms with AI Precision",
        "description": "Protect our future in space! Craft an AI model to predict the intensity and timing of solar flares. Your work can safeguard vital satellite infrastructure and astronaut missions. Harness the data, tame the sun!",
        "detailsLink": "/challenge/challenge2",
        "keywords": ["solar flare prediction", "space weather AI", "astrophysical forecasting", "critical infrastructure protection"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"
    }
]

organizing_committee_data = [
    {"name": "Dr. Gabriele Meoni", "affiliation": "ESA", "role": "General Chair", "imageUrl": "https://0.academia-photos.com/42414807/11430474/34762757/s200_gabriele.meoni.jpg", "bio": "Dr. Meoni is a visionary leader at the European Space Agency, pioneering efforts to integrate artificial intelligence into space exploration. His work focuses on autonomous systems and the ethical implications of AI in cosmic discovery. He is dedicated to fostering collaboration between research institutions and industry to push the boundaries of what's possible beyond Earth."},
    {"name": "Dr. Roberto Del Prete", "affiliation": "ESA", "role": "Program Chair", "imageUrl": "https://avatars.githubusercontent.com/u/71963566?v=4", "bio": "Dr. Del Prete, also from ESA, is instrumental as leading expert in Piking Neural Networks in shaping the workshop's technical program. His expertise lies in machine learning applications for Earth observation and planetary science, ensuring a cutting-edge and impactful agenda."},
    {"name": "Dr. Aisha Khan", "affiliation": "Stellar Data Science Group", "role": "Challenges Chair", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1", "bio": "Dr. Khan leads the charge on the AI4Space challenges. Affiliated with the Stellar Data Science Group, she brings a wealth of experience in designing complex AI competitions and fostering innovation in astrophysical data analysis."},
    {"name": "Dr. Ben Carter", "affiliation": "AstroInformatics Corp.", "role": "Industry Liaison", "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1", "bio": "As the Industry Liaison from AstroInformatics Corp., Dr. Carter bridges the gap between academic research and real-world space industry applications. He is passionate about translating AI breakthroughs into tangible solutions for space exploration and commercialization."}
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

@app.route('/challenge/<challenge_id>')
def serve_challenge_detail_page(challenge_id):
    # Serves the HTML template for a challenge detail page.
    # The actual data will be fetched by the frontend Vue app.
    return send_from_directory(app.static_folder, 'challenge_detail.html')

@app.route('/api/challenges/<challenge_id>')
def get_challenge_details(challenge_id):
    challenge = next((item for item in ai4space_content if item.get('type') == 'Challenge' and item.get('id') == challenge_id), None)
    if challenge:
        return jsonify(challenge)
    return jsonify({"error": "Challenge not found"}), 404

@app.route('/committee')
def serve_committee_page():
    return send_from_directory(app.static_folder, 'committee.html')

@app.route('/api/committee')
def get_committee_data():
    return jsonify(organizing_committee_data)

if __name__ == '__main__':
    app.run(debug=True)
