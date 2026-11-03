from flask import Flask, send_from_directory, jsonify, request
import os
import re

app = Flask(__name__, static_folder='../frontend', static_url_path='')

# Helper function to clean LaTeX and extra whitespace
def clean_text(text):
    text = re.sub(r'\\[a-zA-Z]+\{.*?\}', '', text) # Remove LaTeX commands with arguments
    text = re.sub(r'\\[a-zA-Z]+', '', text) # Remove LaTeX commands without arguments
    text = re.sub(r'%.*?\n', '', text) # Remove LaTeX comments
    text = re.sub(r'\s+', ' ', text).strip() # Replace multiple whitespaces with a single space
    text = text.replace('\n', ' ').replace('{', '').replace('}', '') # Remove newlines and braces
    return text

# --- Data from src/list_organizers.txt ---
organizers_text = r"""
\\subsection{List of organizers}
\\begin{itemize}
    \\item Daniele Gammelli (Stanford University / AI4I)
    \\item Gabriele Meoni (European Space Agency)
    \\item Yuji Takubo (Stanford University)
    \\item Ana-Maria Pelin (TU Delft / ESA Phi-Lab)
    \\item Djamila Aouada (University of Luxembourg)
    \\item Arunkumar Rathinam (University of Luxembourg)
    \\item Tat-Jun Chin (The University of Adelaide)
\\end{itemize}
\\subsection{Primary organizer}
\\begin{itemize}
    \\item Daniele Gammelli
\\end{itemize}
\\subsection{Organizing team’s experience and background}
\\paragraph{Daniele Gammelli}
is a Postdoctoral Scholar at Stanford and Research Fellow at CAESAR and CARS, with a Ph.D. in Machine Learning and Mathematical Optimization from DTU. His research develops algorithmic foundations for safe, reliable AI-powered autonomy, with emphasis on aerospace and large-scale robotic networks. He has been workshop program chair at RSS and CPS-IoT, co-organizer of workshops and tutorials at ITSC, and lead organizer of the CAESAR Annual Meeting (2024, 2025).
\\paragraph{Gabriele Meoni}
is an Innovation Officer at ESA ESRIN, with a Ph.D. in information engineering from the University of Pisa. He works on satellite onboard processing, edge computing, AI4EO, and neuromorphic computing. He is Associate Editor of Astrodynamics and IEEE GRSL, co-chair of the IEEE GRSS ESI technical committee, second organizer of the 3rd and 4th AI4Space workshops, and main organizer of the ESA Workshop on Cognitive Cloud Computing in Space.
\\paragraph{Yuji Takubo}
is a Ph.D. candidate in Aeronautics and Astronautics at Stanford's Space Rendezvous Laboratory, with a B.S. from Georgia Tech. He previously worked at NASA JPL on mission design for Europa Clipper and an Enceladus orbiter concept. His research advances AI for space through foundation models, language-grounded trajectory generation, and autonomous spacecraft guidance. He has received paper and poster awards at AAS, AIAA, and the CVPR 2026 AI4Space Workshop.
\\paragraph{Ana-Maria Pelin}
is an M.Sc. student at TU Delft and Visiting Researcher at ESA Phi-Lab. She previously developed segmentation and stereo matching models for contrail research at Eurocontrol and detection-based controllers at a 3D vision drone startup. Her research focuses on onboard multi-satellite coordination, agentic AI, and multi-agent systems for managing heterogeneous constellations in disaster scenarios.
\\paragraph{Djamila Aouada}
is Deputy Director of the SnT Center at the University of Luxembourg, Head of the CVI2 research group, and co-head of the Zero-G Space Lab. Her research covers 3D vision and multi-sensor fusion. She chaired the SHARP workshops (ECCV'20 to ICCV'23) and SPARK (ICIP'21), was Program Chair of 3DV'21 and EUVIP'23, co-organizer of AI4Space at ECCV'22, and is General Chair of EUVIP'26.
\\paragraph{Arunkumar Rathinam}
is a researcher in machine learning for vision-based navigation in space proximity operations. He created the open-source benchmark datasets SPARK 2022, SPARK 2024, and SPADES, advancing data-driven approaches for space applications. He co-organized the AI4Space/SPARK challenge at ECCV 2022 and CVPR 2024.
\\paragraph{Tat-Jun Chin}
is a Professor of Computer Science at The University of Adelaide working on optimization for vision and learning, robotic vision, and AI for space. He was Program Chair of ACCV'22, Special Sessions Chair of ICIP'23, and Tutorial Chair of CVPR'21 and ACCV'18, and has organized workshops and tutorials at CVPR, ICCV, RSS, and ICRA. He founded the AI4Space workshop series, leading it in 2021, 2022, and 2024.
"""

organizing_committee_data = []
# Crude parsing of organizers and bios
raw_organizers = re.findall(r'\\item (.*?)\n', organizers_text.split('\\subsection{List of organizers}')[1].split('\\end{itemize}')[0])
bios_text = organizers_text.split('\\subsection{Organizing team’s experience and background}')[1]
bio_paragraphs = re.split(r'\\paragraph{(.*?)}', bios_text)[1:] # Split by paragraph, keeping delimiter

parsed_bios = {}
for i in range(0, len(bio_paragraphs), 2):
    name = clean_text(bio_paragraphs[i])
    bio_content = clean_text(bio_paragraphs[i+1]).rstrip(' \\')
    parsed_bios[name] = bio_content

default_image = "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"

for org_item in raw_organizers:
    match = re.match(r'(.*?)\s*\((.*?)\)', clean_text(org_item))
    name, affiliation = match.groups() if match else (clean_text(org_item), "N/A")
    
    # Assign roles based on known individuals or default
    role = "Organizer"
    image_url = default_image
    if "Daniele Gammelli" in name:
        role = "Primary Organizer"
        image_url = "/images/gammelli.jpg"
    elif "Gabriele Meoni" in name:
        role = "Secondary Organizer"
        image_url = "/images/meoni.jpg"
    elif "Yuji Takubo" in name:
        image_url = "/images/takubo.jpg"
    elif "Ana-Maria Pelin" in name:
        image_url = "/images/pelin.jpg"
    elif "Djamila Aouada" in name:
        image_url = "/images/aouada.jpg"
    elif "Arunkumar Rathinam" in name:
        image_url = "/images/rathinam.jpg"
    elif "Tat-Jun Chin" in name:
        image_url = "/images/chin.jpg"

    bio = parsed_bios.get(name.strip(), "Biography not available.")
    organizing_committee_data.append({
        "name": name.strip(),
        "affiliation": affiliation.strip(),
        "role": role,
        "imageUrl": image_url,
        "bio": bio
    })

# Show organizers in alphabetical order by first name
organizing_committee_data.sort(key=lambda member: member["name"])


# --- Data from src/list_speakers.txt ---
invited_speakers_data = [
    {
        "name": 'Steve Chien',
        "bio": "Technical Fellow in Artificial Intelligence and Co-head of the Artificial Intelligence Group at the Jet Propulsion Laboratory (JPL), California Institute of Technology. His work on autonomous science, automated planning and scheduling, and intelligent spacecraft operations includes Earth Observing One, ESA's Rosetta Orbiter, and NASA's Mars 2020 mission.",
        "homepage": 'https://ai.jpl.nasa.gov/public/people/chien/',
        "imageUrl": "/images/chien.jpg",
        "talkType": 'Keynote: Distributed Autonomy in Space Operations and Earth Observation'
    },
    {
        "name": 'Paolo Panicucci',
        "bio": 'Assistant Professor at Politecnico di Milano and researcher at DART Lab, specializing in computer vision, vision-based navigation, and spacecraft autonomy. He has worked on autonomous GNC in projects such as EXTREMA and LUMIO; his talk will cover ESA ION-V and neuromorphic computing and sensing for Earth Observation.',
        "homepage": 'https://dart.polimi.it/member/?p=paolo+panicucci',
        "imageUrl": "/images/panicucci.jpg",
        "talkType": 'Keynote: Disruptive Computing and Sensing Paradigms for EdgeAI in Space'
    },
    {
        "name": 'Al Tadros',
        "bio": 'CTO of Redwire, with over 30 years of experience in aerospace engineering and leadership in AI-enabled autonomy, machine vision, robotics, and rendezvous and proximity operations. Previously Vice President of Space Infrastructure and Civil Space at Maxar Technologies, contributing to 13 space missions.',
        "homepage": 'https://aiaa.org/people/al-tadros/',
        "imageUrl": "/images/tadros.jpg",
        "talkType": 'Keynote: Automating Satellite Manufacturing, Design and Testing'
    },
    {
        "name": 'Hiro Ono',
        "bio": 'Associate Professor at the School of Aerospace Engineering at Georgia Tech and Director of the Planetary Robotics Lab. During 13 years at NASA JPL he developed autonomous navigation algorithms for the Perseverance Mars rover and led the Exobiology Extant Life Surveyor (EELS) snake robot project.',
        "homepage": 'https://ae.gatech.edu/directory/person/masahiro-hiro-ono',
        "imageUrl": "/images/ono.jpg",
        "talkType": 'Keynote: AI for Robotic Planetary Exploration'
    },
    {
        "name": "Simone D'Amico",
        "bio": 'Associate Professor at Stanford University and Founding Director of the Space Rendezvous Laboratory, with over 20 years of experience in autonomous spacecraft and distributed space systems, including TanDEM-X, PRISMA, and NASA Starling.',
        "homepage": 'https://slab.stanford.edu/people/simone-damico',
        "imageUrl": "/images/damico.jpg",
        "talkType": 'Keynote: AI-driven Spacecraft Trajectory Optimization and Autonomous Mission Design'
    },
    {
        "name": 'Roberto Del Prete',
        "bio": 'CTO of Setanta Space and former ESA Phi-lab Research Fellow, specializing in onboard AI and computing for space applications, including the Vertis heterogeneous computing platform.',
        "homepage": 'https://scholar.google.com/citations?user=Dwc8YxwAAAAJ&hl=en',
        "imageUrl": "/images/delprete.jpg",
        "talkType": 'Fishbowl Speaker'
    },
    {
        "name": 'Marco Pavone',
        "bio": 'Professor in the Department of Aeronautics and Astronautics at Stanford University and Director of Autonomous Vehicle Research at NVIDIA, working on motion planning, decision-making under uncertainty, and AI-driven autonomy.',
        "homepage": 'https://web.stanford.edu/~pavone/',
        "imageUrl": "/images/pavone.jpg",
        "talkType": 'Fishbowl Speaker'
    },
]

# --- Data from src/topics.txt ---
topics_text = r"""
Topics covered and subject areas

Background
The space sector is characterized by significant growth due to substantial investment and technology advancements. Areas like Earth Observation (EO), space situational awareness, telecommunication, space exploration have witnessed a remarkable expansion.
In this scenario, Artificial Intelligence (AI) is playing a pivotal role in unlocking novel commercial and  operational mission paradigms thanks to its unprecedented capabilities to enhance spacecraft and satellites' automation, process vast amount of space-borne data and extract actionable information. Examples of applications enabled by AI include autonomous and intelligent rovers for planetary explorations, onboard payload data processing for low-latency deliverable of actionable information from EO satellites, detection of exoplanets from scientific mission data, among others.
Despite these advancements, several technical challenges remain that hinder AI application in space. These include fundamental difficulties in vision and learning for space (e.g., lack of training data, unknown operating environments), limited computing resources and energy budget, harsh operative environment (radiation, extreme temperatures).

Objectives and subject areas
This workshop aims to explore Artificial Intelligence and computer vision algorithms for space applications (primary subject area).
More specifically, the workshop focuses on these specific secondary subject areas (SSA)  relevant to space applications:

    SSA1: ML for onboard spacecraft payload data processing
    SSA2: Autonomous and reliable space systems
    SSA3: Novel sensors and computing devices for AI-powered space systems
    SSA4: Novel datasets, learning and domain adaptation techniques for space applications
    SSA5: ML for astronomy

Topics
A non-exhaustive list of topics relevant to the workshop is as follow. The related SSAs are indicated among brackets:

Onboard AI for payload data processing for EO and other scientific missions (SSA1) (e.g., near-real-time disaster monitoring and latency-constrained applications, distributed learning on satellites, tip and cue systems for satellite missions or telescopes, etc.)
Vision and learning for spacecraft navigation, space robotics, space-situational-awareness, and operations (SSA2) (e.g., rendezvous, proximity operations, docking, space maneuvers, entry descent landing rovers, UAVs, UGVs, UUWs, space debris and space object monitoring)
Fault tolerant vision and learning systems and reliability (e.g., mitigation to challenges of the space environment, AI for Fault Detection Isolation and Recovery)
Sensors for space applications (SSA3) (e.g., optical, multispectral, lidar, radar, neuromorphic)
Onboard computing hardware for vision and learning (SSA3) (e.g., neural network accelerators, neuromorphic processors)
Datasets for space applications, Domain-gap problems, domain adaptation techniques for space applications (SSA4) (e.g., foundation models for space applications, transfer-learning, including training techniques for unlabeled/partially labeled datasets)
ML for astronomy (SSA5)  (e.g., planetary bodies mapping and global positioning, ML for Astronomical Image Processing and Analysis, ML-based Monocular Depth Estimation, Anomaly and Outlier Detection, Differentiable and physics-informed methods)
"""

workshop_overview_text = clean_text(re.search(r'Background\n(.*?)\n\nObjectives and subject areas', topics_text, re.DOTALL).group(1) if re.search(r'Background\n(.*?)\n\nObjectives and subject areas', topics_text, re.DOTALL) else "Detailed overview coming soon.")
workshop_objectives_text = clean_text(re.search(r'Objectives and subject areas\n(.*?)\n\nTopics', topics_text, re.DOTALL).group(1) if re.search(r'Objectives and subject areas\n(.*?)\n\nTopics', topics_text, re.DOTALL) else "Detailed objectives coming soon.")

# Extract topics from the plain text format (each topic starts with a paragraph)
topics_section = topics_text.split('Topics\n')[1] if len(topics_text.split('Topics\n')) > 1 else ""
raw_topics_list = [line.strip() for line in topics_section.split('\n') if line.strip() and not line.strip().startswith('A non-exhaustive')]

workshop_topics_data = []
for topic in raw_topics_list:
    # Extract the main title (everything before the first parenthesis)
    title_match = re.search(r'^(.*?)\s*\(', topic)
    title = title_match.group(1).strip() if title_match else topic.strip()
    
    # Use the full topic text as details
    details = clean_text(topic)
    
    workshop_topics_data.append({"title": title, "details": details})

# Data for the AI4Space Workshop (Tracks and Challenges)
ai4space_content = [
    {
        "id": "track1",
        "type": "Track",
        "title": "🚀 Autonomous Frontiers: Charting the Course for Self-Reliant Space Exploration",
        "description": "Dive into the future of space missions! This track uncovers AI breakthroughs enabling spacecraft, rovers, and robots to think, act, and explore independently. From intelligent pathfinding on distant planets to self-diagnosing critical systems, discover how AI is making a new era of cosmic discovery possible.",
        "lead": "Dr. Astro Innovate", # Placeholder, can be updated if lead is in organizers
        "keywords": ["autonomous systems", "space robotics", "AI mission control", "deep space navigation"],
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1",
        "detailsLink": "/track/track1",
        "longDescription": workshop_overview_text + " " + workshop_objectives_text # Added more details
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
        "imageUrl": "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1",
        "longDescription": "This challenge focuses on leveraging AI to predict solar storm events. Participants will work with solar activity datasets to develop models that can forecast the occurrence and characteristics of solar flares and coronal mass ejections. Accurate predictions are crucial for protecting satellites, power grids, and astronauts from the harmful effects of space weather. This challenge aligns with SSA2 (Autonomous and reliable space systems) and SSA5 (ML for astronomy)." # Example long description
    }
]

# Update workshop overview in the main content if it exists or add it
overview_content_exists = False
for item in ai4space_content:
    if item.get('id') == 'workshop-overview':
        item['description'] = workshop_overview_text
        item['longDescription'] = workshop_overview_text + " " + workshop_objectives_text
        overview_content_exists = True
        break
if not overview_content_exists: # Add a general overview if not specifically listed
    # This might be better handled on the frontend by fetching a dedicated overview API
    pass

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/ai4space-content')
def get_ai4space_content():
    return jsonify(ai4space_content)

@app.route('/track/<track_id>')
def serve_track_detail_page(track_id):
    return send_from_directory(app.static_folder, 'track_detail.html')

@app.route('/api/tracks/<track_id>')
def get_track_details(track_id):
    track = next((item for item in ai4space_content if item.get('type') == 'Track' and item.get('id') == track_id), None)
    if track:
        return jsonify(track)
    return jsonify({"error": "Track not found"}), 404

@app.route('/challenge/<challenge_id>')
def serve_challenge_detail_page(challenge_id):
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

@app.route('/api/speakers')
def get_speakers_data():
    return jsonify(invited_speakers_data)

@app.route('/api/topics')
def get_topics_data():
    return jsonify({
        "overview": workshop_overview_text,
        "objectives": workshop_objectives_text,
        "topics_list": workshop_topics_data
    })

@app.route('/api/contact', methods=['POST'])
def handle_contact_form():
    if not request.is_json:
        return jsonify({"error": "Missing JSON in request"}), 400
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not name or not email or not message:
        return jsonify({"error": "Missing name, email, or message"}), 400

    # For now, just print to console
    print(f"Contact Form Submission:")
    print(f"  Name: {name}")
    print(f"  Email: {email}")
    print(f"  Message: {message}")

    # You could save this to a file or database here
    # with open("contact_submissions.txt", "a") as f:
    #     f.write(f"Name: {name}, Email: {email}, Message: {message}\n")

    return jsonify({"message": "Message received successfully!"}), 200

if __name__ == '__main__':
    app.run(debug=True)
