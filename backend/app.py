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
    \\item Gabriele Meoni (ESRIN, European Space Agency)
    \\item Tat-Jun Chin (The University of Adelaide)
    \\item Djamila Aouada (University of Luxembourg)
    \\item Rajat Talak (Massachusetts Institute of Technology)
    \\item Viorela Ila (The University of Sydney)
    \\item Roberto Del Prete (University of Napoli Federico II)
    \\item Gianluca Furano (ESTEC, European Space Agency)
    \\item Alberto Candela (JPL, NASA)
    \\item Pablo G{\\\'o}mez (ESAC, European  Space Agency)
    \\item Arunkumar Rathinam (University of Luxembourg)
\\end{itemize}
\\subsection{Primary organizer}
\\begin{itemize}
    \\item Gabriele Meoni
\\end{itemize}
\\subsection{Organizing team’s experience and background}
\\paragraph{Gabriele Meoni}
is an Innovation Officer at the European Centre for Earth Observation (ESRIN), European Space Agency. He is part of the Advanced Concepts and Studies Office and the $\\Phi$-lab divisions. Gabriele received his Master\'s degree in Electronic Engineering and his PhD in information engineering from University of Pisa. His research interests include satellite onboard processing, orbital edge computing,  AI for EO, and neuromorphic computing.
He is currently Associate Editor of Astrodynamics (Springer) and was part of the program and scientific committees of various international conferences, including the 1$^st$, 2$^nd$, 3$^rd$ Workshop in AI for space -- of which he was also co-organizer for the  $3^rd$ edition-- FOSS4G 2022, Living Planet Symposium 2022, and  Living  Planet Symposium 2025.
Gabriele received the ESA Corporate Team Award for his contribution to the $\\Phi$-Sat-1 mission, the PRIME 2018 Bronze Leaf paper Award, and
DATE 2019 - University Booth - Best Demonstrator Award.
He is also organized an ESA Workshop on Cognitive Cloud  Computing in Space.
\\paragraph{Tat-Jun Chin}
is SmartSat CRC Professorial Chair of Sentient Satellites at The University of Adelaide. His research interests include optimization for vision and learning, robotic vision and AI for space. His team won the Kelvins Satellite Pose Estimation Challenge twice (2019, 2021), and also placed $3^{rd}$ in the NASA Space Robotics Challenge 2021 (autonomous rovers for space mining).
Tat-Jun has significant experience in professional activities; major roles include Program Chair (ACCV\'22), Special Sessions Chair (ICIP\'23) and Tutorial Chair (CVPR\'21, ACCV\'18). He has also organized workshops/tutorials at CVPR (2021, 2020, 2018), RSS (2020, 2023), ICCV 2019, and ICRA 2020. Tat-Jun also pioneered the AI4Space workshop series, having led the event in 2021,  2022, and 2024.
\\paragraph{Djamila Aouada}
is Senior Research Scientist and Assistant Professor at the Interdisciplinary Centre for
Security, Reliability, and Trust (SnT) of the University of Luxembourg. She is
Head of the Computer Vision, Imaging and Machine Intelligence (CVI$^{2}$) research
group, and co-head of the Zero-G Space Lab. Her research interests include 3D
vision (shape modelling, RGB-D data) and multi-sensor fusion. Djamila served as Chair
of SHARP Workshops (ECCV`20, CVPR`21, CVPR`22, ICCV`23), Chair of SPARK at
ICIP`21, Area Chair at 3DV`20 and 3DV`22, Program Chair at 3DV`21, General Chair at RTIP2R`22, Co-organizer of AI4Space at ECCV`22, and Program Chair at EUVIP`23.
\\paragraph{Rajat Talak}
is a Research Scientist in the Department of Aeronautics and Astronautics at the Massachusetts Institute of Technology. Prior to this, he was a Postdoctoral Associate in the Department of Aeronautics and Astronautics, at the Massachusetts Institute Technology. He received his PhD from the Laboratory of Information and Decision Systems at the Massachusetts Institute Technology in 2020.
His research interests are spatial robot perception, certifiable models, domain adaptation, and networked autonomy. He is the recipient of ACM MobiHoc 2018 Best Paper award, Gold medal for his master\'s thesis, and also co-authored a monograph on the topic of information freshness. He is actively engaged on the topic of safe autonomy and has recently organized a workshop on the topic (Towards Safe Autonomy: New Challenges and Trends in Robot Perception) at the Robotics: Science and Systems Conference in 2023.
\\paragraph{Viorela Ila}
is a senior lecturer with The University of Sydney, School of Aerospace, Mechanical and Mechatronic Engineering. Her research interests span from robot vision to advanced techniques for simultaneous localization and mapping (SLAM) and 3D reconstruction based on cutting-edge computational tools such as graphical models, modern optimization methods and information theory. Viorela has substantial experience in organising workshops and tutorials in field of robotics and computer vision: IROS 2010 - GraphBot2010 - Workshop on Probabilistic Graphical Models in Robotics, ICRA2020 - Sensing, Estimating and Understanding the Dynamic World, ECCV 2022 - AI4Space, Robotic vision Summer school (2016-2018).
\\paragraph{Roberto Del Prete} is Ph.D. candidate specializing in TinyML and edge computing. He focuses on enhancing time-critical decision-making through cutting-edge AI solutions for both space missions and Earth monitoring. Currently pursuing a Ph.D. at the University of Naples Federico II, his work focuses on developing innovative systems such as vision-based navigation and onboard AI solutions for analyzing Synthetic Aperture Radar (SAR) raw data.
Del Prete\'s professional journey includes roles as a Visiting Researcher at both the European Space Agency\'s $\\Phi$-Lab and SmartSat CRC in Australia. Recognized for his contributions, he received the 2022 NATO STO Early Career Scientist Award and participated in the 2021 NASA-ESA Trans-Atlantic Training. Notably, he won the best presentation award at the AI4Space@CVPR workshop in 2024, and
he has been a key contributor to high-impact projects like the Kanyini Mission. With more than 30 scientific publications, Del Prete\'s dedication to leveraging AI and remote sensing technologies aims to address global challenges in EO and space exploration.
\\paragraph{Gianluca Furano}
Gianluca Furano received the Ph.D. in
microelectronics engineering from University of Rome and since 2003 works for the European
Space Agency’s Data System Division, Noordwijk,
The Netherlands.
He is in charge of research and development activities and he coordinates European Space
Agency (ESA) activities on on-board artificial intelligence. He has authored or coauthored more than
100 publications. Among his interests in ESA are
on-board data handling systems and their major
components, such as space grade microprocessors
and support electronics, meeting very stringent requirements in terms of radiation tolerance, reliability, availability, and safety; key avionics building
blocks such as platform mass memories, remote terminal units, on-board buses, and data networks; and on-board and space to ground data communication protocols including protocol security aspects. He also provides support to European Standardization [Consultative Committee for Space Data
Systems (CCSDS), European Cooperation for Space Standardization (ECSS)] in areas such as telemetry, telecommand and on-board data, and wireless and
monitoring control interfaces.
\\paragraph{Pablo G{\\\'o}mez}
is a Data Scientist in the Data Science Section at the European Space Agency (ESA), based at the European Space Astronomy Center (ESAC) near Madrid. His work focuses on leveraging ML methods to maximise the scientific return from missions such as Gaia, XMM-Newton, Euclid, and Ariel, alongside building and improving the ESA Datalabs platform for enhanced science data analysis.
Previously, Pablo was a Research Fellow in ESA’s Advanced Concepts Team (ACT), where he worked on various projects involving remote sensing, semi-supervised learning, astrophysics, and differentiable methods. He completed a secondment to AI Sweden in Stockholm on distributed onboard ML. He holds an M.Sc. in Computer Science from the Technical University of Munich (TUM) and a Ph.D. in Electrical Engineering from the Friedrich-Alexander-Universität Erlangen-Nürnberg (FAU), where he developed deep learning techniques for high-speed video endoscopy and numerical models of the human voice.
Pablo has extensive experience in organising events, including the AI for Space workshop at CVPR 2021, the Space Optimisation Competition at GECCO 2022, the Accessibility in Human Spaceflight webinar in 2023, and the forthcoming ESA Datalabs Ariel Hackathon in 2025.
\\paragraph{Alberto Candela}
is a Data Scientist in the Artificial Intelligence Group at the Jet Propulsion Laboratory, California Institute of Technology. He is a researcher who works at the intersection of perception, learning and planning to create new methods for onboard science data analysis and autonomous decision-making; applications include planetary rovers, satellites and remote sensing instruments. At JPL, Alberto has worked on developing deep learning models for image and spectral analysis on board the ISS and spacecraft such as CogniSat-6 and YAM-6, improving the AEGIS AI software for science autonomy on NASA Mars rovers, increasing the autonomy capabilities of the Mars Helicopter, and onboard planning for the Endurance lunar rover concept. He received his Ph.D. and M.S. in Robotics from Carnegie Mellon University, and his B.S. in Mechatronics Engineering from Instituto Tecnológico Autónomo de México. Alberto received the NASA Group Achievement Award, the JPL Voyager Award, and was finalist for the IEEE/RSJ IROS Best Paper Award on Cognitive Robotics. He has served as program committee member of the International Workshop of Planning and Scheduling for Space (IWPSS) since 2021.
\\paragraph{Arunkumar Rathinam}
Arunkumar Rathinam is a Research Scientist at the Interdisciplinary Centre for Security, Reliability, and Trust (SnT) at the University of Luxembourg. He is a member of the Computer Vision, Imaging and Machine Intelligence (CVI2) research group within SnT. Before joining SnT, he was a Postdoctoral Associate at the Surrey Space Center, University of Surrey, UK. He earned his PhD from the University of New South Wales, Sydney, Australia, in 2019. His research focuses on developing machine learning algorithms for vision-based navigation for proximity operations in space. He has also created several open-source benchmark datasets, including SPARK 2022, SPARK 2024, and SPADES, aimed at advancing data driven approaches for space applications. He has also served as a co-organizer of the previous edition of AI4Space/SPARK challenge at ECCV 2022 and CVPR 2024.
"""

organizing_committee_data = []
# Crude parsing of organizers and bios
raw_organizers = re.findall(r'\\item (.*?)\n', organizers_text.split('\\subsection{List of organizers}')[1].split('\\end{itemize}')[0])
bios_text = organizers_text.split('\\subsection{Organizing team’s experience and background}')[1]
bio_paragraphs = re.split(r'\\paragraph{(.*?)}', bios_text)[1:] # Split by paragraph, keeping delimiter

parsed_bios = {}
for i in range(0, len(bio_paragraphs), 2):
    name = clean_text(bio_paragraphs[i])
    bio_content = clean_text(bio_paragraphs[i+1])
    parsed_bios[name] = bio_content

default_image = "https://i0.wp.com/www.sciencenews.org/wp-content/uploads/2022/11/Hubble-Pillars-of-Creation.jpg?resize=1500%2C1565&ssl=1"

for org_item in raw_organizers:
    match = re.match(r'(.*?)\s*\((.*?)\)', clean_text(org_item))
    name, affiliation = match.groups() if match else (clean_text(org_item), "N/A")
    
    # Assign roles based on known individuals or default
    role = "Organizer"
    image_url = default_image
    if "Gabriele Meoni" in name:
        role = "General Chair"
        image_url = "https://0.academia-photos.com/42414807/11430474/34762757/s200_gabriele.meoni.jpg"
    elif "Roberto Del Prete" in name:
        role = "Program Chair"
        image_url = "https://avatars.githubusercontent.com/u/71963566?v=4"
    elif "Tat-Jun Chin" in name:
        role = "Co-Chair" # Example role
    elif "Djamila Aouada" in name:
        role = "Co-Chair" # Example role


    bio = parsed_bios.get(name.strip(), "Biography not available.")
    organizing_committee_data.append({
        "name": name.strip(),
        "affiliation": affiliation.strip(),
        "role": role,
        "imageUrl": image_url,
        "bio": bio
    })


# --- Data from src/list_speakers.txt ---
speakers_text = r"""
\\subsection{List of invited speakers}
\\subsubsection*{Invited Speaker 1: Victoria Ashley Villar}
\\begin{itemize}[parsep=1em]
\\item \\textbf{Brief biography}
Victoria Ashley Villar received her B.S. in Physics from MIT in 2014 and her Ph.D. in Astronomy and Astrophysics from Harvard University in 2020. She was formerly a Simons Junior Postdoctoral Fellow at Columbia University (2020-2021) and a faculty member at Penn State University (2021-2023), before joining the Harvard Astronomy faculty in 2023. Prof. Villar’s research interests include theoretical and observational studies of extragalactic transients, including core-collapse supernovae and kilonovae, development of statistical and deep learning methodologies for wide-field surveys, such as the Vera C. Rubin Observatory\'s Legacy Survey of Space and Time and Nancy Grace Roman Observatory. Prof. Ashley Villar is a Packard Fellow, RCSA Scialog Fellow and Harvard Aramont Fellow.
\\item \\textbf{Relevance to workshop}
Prof. Villar is a prominent researcher from Harvard University in the use of data-driven methods in astronomy.
She has made significant contributions to the field by developing statistical and deep learning methodologies to study chemical compositions of supernovae, stellar phenomena such as eruptions, mergers, and explosions, and detect celestial bodies in astronomical data.
The invited talk will provide insight novel applications in the field of astronomy enabled by ML and deep learning, showcasing the potential of AI for astronomical data processing.
\\item \\textbf{Confirmation status}
Confirmed/Final (In person. Virtual presentation is possible if the speaker cannot attend in person due to unforeseen reasons.).
\\item \\textbf{Link to homepage}
\\url{http://ashleyvillar.com/}
\\end{itemize}
\\subsubsection*{Invited Speaker 2 (Industrial talk): David Rijlaarsdam}
\\begin{itemize}[parsep=1em]
\\item \\textbf{Brief biography}
David Rijlaarsdam is Director of Space System Engineering for Ubotica Technologies, where he manages the Space System R&D team and is involved as a System Engineer in several space missions. He has a Master of Science in Aerospace Engineering from Delft University of Technology with a specialization in Space System Engineering. David has previously been part of the Automation and Robotics Section of the European Space Agency where he researched relative navigation for spacecraft and has been part of the advanced architecture team of Intel Movidius, where he researched the application of AI for star identification algorithms.
\\item \\textbf{Relevance to workshop}
Ubotica Technologies contributed to integrate machine learning solutions for payload image processing in numerous satellite missions, such as ESA $\\Phi$-Sat-1, and $\\Phi$Sat-2, and CogniSat-6 (proprietary satellite). In this keynote, David Rijlaarsdam will share Ubotica\'s vision on challenges and perspectives related to the use of Machine Learning and Artificial Intelligence solutions in spacecraft missions.
\\item \\textbf{Confirmation status}
Confirmed/Final (in person. Virtual presentation is possible if the speaker cannot attend in person due to unforeseen reasons.)
\\item \\textbf{Link to homepage}
\\url{https://ubotica.com/}
\\end{itemize}
\\subsubsection*{Invited Speaker 3: James Parr}
\\begin{itemize}[parsep=1em]
\\item \\textbf{Brief biography}
James is the founder and Chief Executive Officer (CEO) of Trillium Technologies - a global technology contractor that specialises in the application of AI and systems approaches to grand challenges, such as climate change, violent extremism, prevention strategies for cancer and obesity, deforestation mitigation, climate resilience and planetary defence.
He is founder of FDL, an AI research lab partnership with ESA in Europe (ESLab.ai) and NASA in the USA. FDL has over 50 applied AI firsts and was awarded the best AI accelerator at the 2023 Cog X awards in London.
He lives in London with his wife and twin daughters.
\\item \\textbf{Relevance to workshop}
James Parr is the CEO of Trillium Technologies, which oversees the Frontiers Development Lab (FDL) Europe project. This initiative, in partnership with ESA’s $\\Phi$-Lab, ESA ESRIN, and the University of Oxford, focuses on advancing AI and high-performance computing for EO applications. Through numerous research sprints, Trillium Technologies fosters collaboration to develop AI-based solutions to complex research problems, such as: the design of a Deep Learning model for onboard satellite detection of floods or the use of AI to support the design of ESA VIGIL mission.
\\item \\textbf{Confirmation status}
Confirmed/Final (in person. Virtual presentation is possible if the speaker cannot attend in person due to unforeseen reasons.)
\\item \\textbf{Link to homepage}
\\url{https://trillium.tech/}
\\end{itemize}
"""

invited_speakers_data = []
speaker_sections = speakers_text.split('\\subsubsection*')
for section in speaker_sections:
    if not section.strip():
        continue

    name_match = re.search(r'Invited Speaker \d+(?: \(Industrial talk\))?: (.*?)', section)
    name = clean_text(name_match.group(1)) if name_match else "N/A"

    bio_match = re.search(r'Brief biography(.*?)(?:\\item|\\end{itemize})', section, re.DOTALL)
    bio = clean_text(bio_match.group(1)) if bio_match else "N/A"

    relevance_match = re.search(r'Relevance to workshop(.*?)(?:\\item|\\end{itemize})', section, re.DOTALL)
    relevance = clean_text(relevance_match.group(1)) if relevance_match else "N/A"
    
    status_match = re.search(r'Confirmation status(.*?)(?:\\item|\\end{itemize})', section, re.DOTALL)
    status = clean_text(status_match.group(1)) if status_match else "N/A"

    homepage_match = re.search(r'Link to homepage\\s*\\url{(.*?)}', section)
    homepage = homepage_match.group(1) if homepage_match else "#"
    
    talk_type = "Academic Talk"
    if "(Industrial talk)" in section:
        talk_type = "Industrial Talk"

    invited_speakers_data.append({
        "name": name,
        "bio": bio,
        "relevance": relevance,
        "status": status,
        "homepage": homepage,
        "imageUrl": default_image, # Placeholder, ideally replace with actual images
        "talkType": talk_type
    })

# --- Data from src/topics.txt ---
topics_text = r"""
\\subsection{Topics covered and subject areas}
\\label{subsec: topics}
\\subsubsection{Background}
The space sector is characterized by significant growth due to substantial investment and technology advancements. Areas like Earth Observation (EO), space situational awareness, telecommunication, space exploration have witnessed a remarkable expansion.
In this scenario, Artificial Intelligence (AI) is playing a pivotal role in unlocking novel commercial and  operational mission paradigms thanks to its unprecedented capabilities to enhance spacecraft and satellites' automation, process vast amount of space-borne data and extract actionable information. Examples of applications enabled by AI include autonomous and intelligent rovers for planetary explorations, onboard payload data processing for low-latency deliverable of actionable information from EO satellites, detection of exoplanets from scientific mission data, among others.
Despite these advancements, several technical challenges remain that hinder AI application in space. These include fundamental difficulties in vision and learning for space (\eg, lack of training data, unknown operating environments), limited computing resources and energy budget, harsh operative environment (radiation, extreme temperatures).
\\subsubsection{Objectives and subject areas}
This workshop aims to explore \\textbf{Artificial Intelligence and computer vision algorithms for space applications} (\\textbf{primary subject area}).
More specifically, the workshop focuses on these specific \\textbf{secondary subject areas (SSA)}  relevant to space applications:
\\begin{itemize}
    \\item \\textbf{SSA1}: ML for onboard spacecraft payload data processing
    \\item \\textbf{SSA2}: Autonomous and reliable space systems
    \\item \\textbf{SSA3}: Novel sensors and computing devices for AI-powered space systems
    \\item \\textbf{SSA4}: Novel datasets, learning and domain adaptation techniques for space applications
    \\item \\textbf{SSA5}: ML for astronomy
\\end{itemize}
\\subsubsection{Topics}
A non-exhaustive list of topics relevant to the workshop is as follow. The related SSAs are indicated among brackets:
\\begin{itemize}
\\item \\textbf{Onboard AI for payload data processing for EO and other scientific missions (SSA1)} (\eg, near-real-time disaster monitoring and latency-constrained applications, distributed learning on satellites, tip and cue systems for satellite missions or telescopes, etc.)
\\item \\textbf{Vision and learning for spacecraft navigation, space robotics, space-situational-awareness, and operations (SSA2)} (\eg, rendezvous, proximity operations, docking, space maneuvers, entry descent landingrovers, UAVs, UGVs, UUWs, space debris and space object monitoring)
\\item \\textbf{Fault tolerant vision and learning systems and reliability} (\eg, mitigation to challenges of the space environment, AI for Fault Detection Isolation and Recovery)
\\item \\textbf{Sensors for space applications (SSA3)} (\eg, optical, multispectral, lidar, radar, neuromorphic)
\\item \\textbf{Onboard computing hardware for vision and learning (SSA3)} (\eg, neural network accelerators, neuromorphic processors)
\\item \\textbf{Datasets for space applications, Domain-gap problems, domain adaptation techniques for space applications (SSA4)} (\eg, foundation models for space applications, transfer-learning, including training techniques for unlabeled/partially labeled datasets)
\\item \\textbf{ML for astronomy (SSA5)}  (\eg, planetary bodies mapping and global positioning, ML for Astronomical Image Processing and Analysis, ML-based Monocular Depth Estimation, Anomaly and Outlier Detection, Differentiable and physics-informed methods)
\\end{itemize}
"""

workshop_overview_text = clean_text(re.search(r'\\subsubsection{Background}(.*?)\\subsubsection{Objectives and subject areas}', topics_text, re.DOTALL).group(1) if re.search(r'\\subsubsection{Background}(.*?)\\subsubsection{Objectives and subject areas}', topics_text, re.DOTALL) else "Detailed overview coming soon.")
workshop_objectives_text = clean_text(re.search(r'\\subsubsection{Objectives and subject areas}(.*?)\\subsubsection{Topics}', topics_text, re.DOTALL).group(1) if re.search(r'\\subsubsection{Objectives and subject areas}(.*?)\\subsubsection{Topics}', topics_text, re.DOTALL) else "Detailed objectives coming soon.")

raw_topics_list = re.findall(r'\\item \\textbf{(.*?)}', topics_text.split('\\subsubsection{Topics}')[1]) if len(topics_text.split('\\subsubsection{Topics}')) > 1 else []
workshop_topics_data = [{"title": clean_text(topic.split('(')[0]), "details": clean_text(topic)} for topic in raw_topics_list]

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
