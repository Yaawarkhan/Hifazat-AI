# Welcome to Hifazat-AI

## Project info
This project proposes an AI-powered smart surveillance and response system that transforms traditional CCTV infrastructure into an intelligent, proactive security platform for large university campuses like Aligarh Muslim University (AMU). By integrating advanced computer vision, sound analysis, geospatial mapping, and real-time communication, the system enables instant incident detection, natural-language video search, silent SOS signaling, threat identification, and coordinated security response. Designed as a software-first, cost-effective solution, it leverages existing cameras and infrastructure while remaining scalable for future upgrades such as autonomous drone responders. The result is a faster, smarter, and more reliable campus security ecosystem.

## How can I edit this code?
There are several ways you can do it:

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

1. Programming & Core Frameworks
Python: The primary language for logic, AI inference, and backend operations.

OpenCV (cv2): Used for real-time video stream capture, frame manipulation, drawing bounding boxes, and image preprocessing.

Flask / FastAPI: (Depending on your dashboard/ implementation) Used to serve the web interface and handle API requests for the "God View."

2. Artificial Intelligence & Computer Vision
YOLOv8 (Ultralytics): The core object detection engine used for weapons, vehicles, and person detection.

MediaPipe: Specifically used for the Pose Landmarking model to track body joints for SOS gesture detection.

CLIP (OpenAI): Utilized via the sentence-transformers library to enable the natural language "Forensic Smart Search."

DeepFace / InsightFace: The underlying frameworks for facial recognition and extracting identity embeddings.

PaddleOCR / EasyOCR: Used for extracting text from vehicle license plates.

3. Data Management & Storage
ChromaDB / Faiss: Vector databases used to store and search the image embeddings for the Forensic Search feature.

PostgreSQL / SQLite: Relational databases used to store the student registry (Enrollment IDs) and the AMU-registered vehicle database.

NumPy & Pandas: Used for heavy mathematical operations on coordinate arrays and managing historical log data.

4. External APIs & Integrations
Twilio API: The bridge used to send automated WhatsApp alerts and security notifications.

Google Maps JavaScript API: Powers the "God View" geospatial dashboard for campus-wide monitoring.

MQTT (Paho-MQTT): Likely used for the "Campus Lockdown" signaling, allowing the central server to talk to remote camera nodes or IoT gate locks.

5. Tools & Utilities
PyTorch / ONNX Runtime: Used as the inference engine to run the deep learning models efficiently.

Shapely: A geometry library used for the "Virtual Fencing" logic (calculating if a point is inside a digital boundary).

YAML / JSON: For handling system configurations and security thresholds.



Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
