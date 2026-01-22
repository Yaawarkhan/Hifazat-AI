"""
AMU-Guard AI Backend Configuration
"""

# Camera Sources
# Use 0 for webcam, or RTSP URLs for IP cameras
CAMERA_SOURCES = {
    "cam-1": {
        "source": 0,  # Webcam
        "name": "Main Gate",
        "location": "Centenary Gate"
    },
    # Add more cameras as needed:
    # "cam-2": {
    #     "source": "rtsp://admin:password@192.168.1.100:554/stream",
    #     "name": "Library Entrance",
    #     "location": "Maulana Azad Library"
    # },
}

# Detection Settings
YOLO_MODEL = "yolo11n.pt"  # Use nano model for speed
YOLO_CONFIDENCE = 0.5      # Minimum confidence for detection
PROCESS_EVERY_N_FRAMES = 3 # Process every Nth frame for speed

# Facial Recognition Settings
KNOWN_FACES_DIR = "known_faces"
FACE_RECOGNITION_TOLERANCE = 0.6  # Lower = more strict

# Detection Classes to Track
PERSON_CLASSES = ["person"]
VEHICLE_CLASSES = ["car", "truck", "bus", "motorcycle", "bicycle"]
THREAT_CLASSES = ["knife", "scissors"]  # Add weapon classes if available

# Colors (BGR format for OpenCV)
COLORS = {
    "person": (0, 255, 0),      # Green
    "vehicle": (255, 165, 0),   # Blue
    "face": (255, 0, 255),      # Magenta
    "threat": (0, 0, 255),      # Red
}

# WebSocket Settings
WS_HOST = "0.0.0.0"
WS_PORT = 8000
FRAME_QUALITY = 80  # JPEG quality (1-100)
