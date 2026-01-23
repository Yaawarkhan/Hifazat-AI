# AMU-Guard AI Backend

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install fastapi uvicorn opencv-python ultralytics face_recognition numpy
```

### 2. Known Faces (Already Configured)
The following faces are pre-loaded for recognition:
- **Mohammad Yaawar Khan** (`known_faces/Mohammad_Yaawar_Khan.jpeg`)
- **Bakhtiyar Khan** (`known_faces/Bakhtiyar_Khan.jpeg`)
- **Faiz Ahmad Khan** (`known_faces/Faiz_Ahmad_Khan.jpeg`)

To add more faces, place images in `known_faces/` folder. Filename becomes the label.

### 3. Run the Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Connect Mobile Camera
1. Find your computer's local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. On your phone, scan the QR code from the dashboard
3. Enter the WebSocket URL: `ws://YOUR_IP:8000/ws/mobile`
4. Start camera → Connect to backend
5. Point the phone camera at a face — bounding boxes + names appear on the dashboard!

## Architecture Flow
```
Phone Camera → /ws/mobile → YOLO + FaceRecognition → Broadcast → Dashboard /ws
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check + system status |
| `GET /cameras` | List available cameras |
| `WS /ws` | Dashboard receives processed frames + detections |
| `WS /ws/mobile` | Mobile camera sends frames for processing |

## Configuration

Edit `config.py` to customize:
- Detection confidence thresholds
- Frame processing interval (every Nth frame)
- Face recognition tolerance
- Video quality settings
