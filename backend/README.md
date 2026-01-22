# AMU-Guard AI - Python Backend

This is the Python backend for the AMU-Guard AI security system. It handles:
- Camera stream processing with YOLO11
- Facial recognition with face_recognition library
- WebSocket streaming to the React frontend

## Setup

### 1. Install Dependencies

```bash
pip install fastapi uvicorn opencv-python ultralytics face_recognition numpy websockets python-multipart
```

### 2. Download YOLO Model

```bash
# The model will auto-download on first run, or manually:
wget https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt
```

### 3. Add Known Faces

Place reference images in `known_faces/` folder:
```
known_faces/
  ├── John_Doe.jpg
  ├── Jane_Smith.jpg
  └── Admin_User.png
```

The filename (without extension) becomes the person's name label.

### 4. Run the Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The WebSocket endpoint will be available at `ws://localhost:8000/ws`

## API Endpoints

- `GET /` - Health check
- `GET /cameras` - List available cameras
- `WS /ws` - WebSocket stream for video frames and detections

## Configuration

Edit `config.py` to customize:
- Camera sources (webcam, RTSP, video files)
- Detection confidence thresholds
- Frame processing interval
- Known faces directory
