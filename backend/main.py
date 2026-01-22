"""
AMU-Guard AI Backend - FastAPI WebSocket Server
Handles YOLO detection + facial recognition + streaming to React frontend
"""

import asyncio
import base64
import json
import os
import cv2
import numpy as np
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

# Optional: face_recognition (install separately)
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    print("⚠️ face_recognition not installed. Facial recognition disabled.")

from config import (
    CAMERA_SOURCES, YOLO_MODEL, YOLO_CONFIDENCE, PROCESS_EVERY_N_FRAMES,
    KNOWN_FACES_DIR, FACE_RECOGNITION_TOLERANCE, PERSON_CLASSES,
    VEHICLE_CLASSES, THREAT_CLASSES, COLORS, FRAME_QUALITY
)


# === Known Faces Database ===
known_face_encodings: List[np.ndarray] = []
known_face_names: List[str] = []


def load_known_faces():
    """Load reference faces from known_faces directory."""
    global known_face_encodings, known_face_names
    
    if not FACE_RECOGNITION_AVAILABLE:
        return
    
    faces_dir = Path(KNOWN_FACES_DIR)
    if not faces_dir.exists():
        faces_dir.mkdir(parents=True)
        print(f"📁 Created {KNOWN_FACES_DIR}/ - Add reference images here")
        return
    
    for img_path in faces_dir.glob("*.*"):
        if img_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
            continue
        
        try:
            image = face_recognition.load_image_file(str(img_path))
            encodings = face_recognition.face_encodings(image)
            
            if encodings:
                known_face_encodings.append(encodings[0])
                # Use filename (without extension) as name
                name = img_path.stem.replace("_", " ")
                known_face_names.append(name)
                print(f"✅ Loaded face: {name}")
        except Exception as e:
            print(f"❌ Failed to load {img_path}: {e}")
    
    print(f"📊 Loaded {len(known_face_names)} known faces")


# === Camera Stream Manager ===
class CameraStream:
    def __init__(self, camera_id: str, source, name: str, location: str):
        self.camera_id = camera_id
        self.source = source
        self.name = name
        self.location = location
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_count = 0
        self.is_running = False
        
    def start(self):
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise RuntimeError(f"Failed to open camera: {self.source}")
        self.is_running = True
        print(f"📷 Started camera: {self.name}")
        
    def stop(self):
        self.is_running = False
        if self.cap:
            self.cap.release()
        print(f"🛑 Stopped camera: {self.name}")
        
    def read_frame(self) -> Optional[np.ndarray]:
        if not self.cap or not self.is_running:
            return None
        ret, frame = self.cap.read()
        if ret:
            self.frame_count += 1
            return frame
        return None


# === Detection Processor ===
class DetectionProcessor:
    def __init__(self):
        print(f"🔄 Loading YOLO model: {YOLO_MODEL}")
        self.model = YOLO(YOLO_MODEL)
        self.class_names = self.model.names
        print(f"✅ YOLO model loaded with {len(self.class_names)} classes")
        
    def process_frame(self, frame: np.ndarray) -> Dict:
        """Run YOLO detection + facial recognition on frame."""
        detections = []
        annotated_frame = frame.copy()
        
        # === YOLO Detection ===
        results = self.model(frame, conf=YOLO_CONFIDENCE, verbose=False)
        
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
                
            for box in boxes:
                cls_id = int(box.cls[0])
                cls_name = self.class_names[cls_id]
                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                # Determine detection class
                if cls_name in THREAT_CLASSES:
                    det_class = "threat"
                elif cls_name in VEHICLE_CLASSES:
                    det_class = "vehicle"
                elif cls_name in PERSON_CLASSES:
                    det_class = "person"
                else:
                    continue  # Skip other classes
                
                color = COLORS[det_class]
                
                # Draw bounding box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                
                # Draw label
                label = f"{cls_name} {conf:.0%}"
                (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(annotated_frame, (x1, y1 - 20), (x1 + w, y1), color, -1)
                cv2.putText(annotated_frame, label, (x1, y1 - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                
                # Calculate percentage-based bounding box for frontend
                h_frame, w_frame = frame.shape[:2]
                detections.append({
                    "id": f"{det_class}-{len(detections)}",
                    "class": det_class,
                    "label": cls_name.capitalize(),
                    "confidence": conf,
                    "boundingBox": {
                        "x": (x1 / w_frame) * 100,
                        "y": (y1 / h_frame) * 100,
                        "width": ((x2 - x1) / w_frame) * 100,
                        "height": ((y2 - y1) / h_frame) * 100,
                    }
                })
        
        # === Facial Recognition ===
        if FACE_RECOGNITION_AVAILABLE and known_face_encodings:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Find faces
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)
            
            for (top, right, bottom, left), face_encoding in zip(face_locations, face_encodings):
                # Compare with known faces
                matches = face_recognition.compare_faces(
                    known_face_encodings, face_encoding, tolerance=FACE_RECOGNITION_TOLERANCE
                )
                name = "Unknown"
                
                if True in matches:
                    # Find best match
                    face_distances = face_recognition.face_distance(known_face_encodings, face_encoding)
                    best_match_idx = np.argmin(face_distances)
                    if matches[best_match_idx]:
                        name = known_face_names[best_match_idx]
                
                # Draw face box
                color = COLORS["face"]
                cv2.rectangle(annotated_frame, (left, top), (right, bottom), color, 2)
                
                # Draw name label
                cv2.rectangle(annotated_frame, (left, top - 25), (right, top), color, -1)
                cv2.putText(annotated_frame, name, (left + 5, top - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                # Add to detections
                h_frame, w_frame = frame.shape[:2]
                detections.append({
                    "id": f"face-{len(detections)}",
                    "class": "face",
                    "label": "Face",
                    "confidence": 0.95 if name != "Unknown" else 0.7,
                    "personName": name,
                    "boundingBox": {
                        "x": (left / w_frame) * 100,
                        "y": (top / h_frame) * 100,
                        "width": ((right - left) / w_frame) * 100,
                        "height": ((bottom - top) / h_frame) * 100,
                    }
                })
        
        return {
            "annotated_frame": annotated_frame,
            "detections": detections
        }


# === WebSocket Manager ===
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"🔌 Client connected. Total: {len(self.active_connections)}")
        
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"🔌 Client disconnected. Total: {len(self.active_connections)}")
        
    async def broadcast(self, message: Dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


# === FastAPI App ===
manager = ConnectionManager()
cameras: Dict[str, CameraStream] = {}
processor: Optional[DetectionProcessor] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global processor
    
    # Startup
    load_known_faces()
    processor = DetectionProcessor()
    
    # Initialize cameras
    for cam_id, config in CAMERA_SOURCES.items():
        cameras[cam_id] = CameraStream(
            cam_id, config["source"], config["name"], config["location"]
        )
    
    yield
    
    # Shutdown
    for cam in cameras.values():
        cam.stop()


app = FastAPI(title="AMU-Guard AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "AMU-Guard AI Backend",
        "status": "running",
        "cameras": len(cameras),
        "known_faces": len(known_face_names)
    }


@app.get("/cameras")
async def list_cameras():
    return [
        {"id": cam_id, "name": cam.name, "location": cam.location}
        for cam_id, cam in cameras.items()
    ]


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Start camera for this connection
    cam = cameras.get("cam-1")
    if cam:
        try:
            cam.start()
        except Exception as e:
            await websocket.send_json({"type": "error", "data": str(e)})
            return
    
    try:
        while True:
            if cam and cam.is_running:
                frame = cam.read_frame()
                
                if frame is not None:
                    # Process every Nth frame
                    if cam.frame_count % PROCESS_EVERY_N_FRAMES == 0:
                        result = processor.process_frame(frame)
                        annotated = result["annotated_frame"]
                        detections = result["detections"]
                    else:
                        annotated = frame
                        detections = []
                    
                    # Encode frame as base64 JPEG
                    _, buffer = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, FRAME_QUALITY])
                    frame_b64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Send frame
                    await websocket.send_json({
                        "type": "frame",
                        "cameraId": cam.camera_id,
                        "data": f"data:image/jpeg;base64,{frame_b64}"
                    })
                    
                    # Send detections
                    if detections:
                        await websocket.send_json({
                            "type": "detection",
                            "cameraId": cam.camera_id,
                            "data": detections
                        })
            
            await asyncio.sleep(0.033)  # ~30 FPS
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if cam:
            cam.stop()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
