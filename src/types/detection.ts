export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Detection {
  id: string;
  class: "person" | "vehicle" | "face" | "threat";
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
  timestamp: number;
  // For facial recognition
  personName?: string;
}

export interface CameraFeed {
  id: string;
  name: string;
  location: string;
  status: "online" | "offline" | "connecting";
  streamUrl?: string;
  detections: Detection[];
  lastFrame?: string; // base64 encoded frame with detections drawn
}

export type CampusStatus = "secure" | "alert" | "lockdown";

export interface AlertEvent {
  id: string;
  type: "threat" | "sos" | "sound" | "intrusion";
  message: string;
  cameraId: string;
  cameraName: string;
  timestamp: number;
  snapshot?: string;
  acknowledged: boolean;
}

export interface WebSocketMessage {
  type: "frame" | "detection" | "alert" | "status";
  cameraId: string;
  data: unknown;
}
