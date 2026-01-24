import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Settings, Bell, Moon, Sun, Brain, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { CameraCard } from "@/components/dashboard/CameraCard";
import { LiveFeedViewer } from "@/components/dashboard/LiveFeedViewer";
import { EventLog } from "@/components/dashboard/EventLog";
import { QRCodePanel } from "@/components/dashboard/QRCodePanel";
import { ThreatOverlay } from "@/components/dashboard/ThreatOverlay";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useThreatDetection } from "@/hooks/useThreatDetection";
import { useDemoMode } from "@/hooks/useWebSocket";
import type { CameraFeed, Detection, CampusStatus } from "@/types/detection";
import { Badge } from "@/components/ui/badge";

const PREVIEW_URL = "https://id-preview--704dc477-74cd-4433-8298-df359598f7bb.lovable.app";

// Performance settings
const FRAME_SKIP = 2; // Process every Nth frame
const FACE_DETECTION_SKIP = 5; // Run face detection every Nth frame

export default function Index() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>("mobile-cam");
  const [threatActive, setThreatActive] = useState(false);
  const [sosProgress, setSOSProgress] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameCounterRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const lastFPSUpdateRef = useRef(Date.now());

  // Demo mode for UI testing
  const {
    cameras,
    setCameras,
    alerts,
    addAlert,
    acknowledgeAlert,
    campusStatus,
    setCampusStatus,
    resetStatus,
  } = useDemoMode();

  // Face recognition
  const { isModelLoaded: faceModelLoaded, isLoading: isFaceLoading, detectFaces, knownFacesCount } = useFaceRecognition();

  // Pose detection for SOS
  const { isModelLoaded: poseModelLoaded, isLoading: isPoseLoading, detectPose, resetSOSState } = usePoseDetection();

  // Threat detection
  const { createAlert, processThreats } = useThreatDetection();

  // Calculate FPS
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastFPSUpdateRef.current) / 1000;
      setActualFPS(Math.round(fpsCounterRef.current / elapsed));
      fpsCounterRef.current = 0;
      lastFPSUpdateRef.current = now;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle incoming frames from mobile camera
  const handleFrame = useCallback(
    async (frame: { cameraId: string; frame: string; timestamp: number }) => {
      fpsCounterRef.current++;
      frameCounterRef.current++;

      // Update camera with new frame immediately (for smooth display)
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === frame.cameraId
            ? { ...cam, lastFrame: frame.frame, status: "online" as const }
            : cam
        )
      );

      // Skip frames for AI processing (performance optimization)
      const shouldProcessFaces = frameCounterRef.current % FACE_DETECTION_SKIP === 0;
      const shouldProcessPose = frameCounterRef.current % FRAME_SKIP === 0;

      if (!imageRef.current) return;

      // Load image for processing
      const img = imageRef.current;
      img.src = frame.frame;

      img.onload = async () => {
        let detections: Detection[] = [];

        // Run face detection (throttled)
        if (faceModelLoaded && shouldProcessFaces) {
          const faces = await detectFaces(img);
          detections = faces.map((face) => ({
            id: face.id,
            class: "face" as const,
            label: "Face",
            confidence: face.confidence,
            personName: face.name,
            boundingBox: face.boundingBox,
            timestamp: Date.now(),
          }));
        }

        // Run pose detection for SOS (throttled)
        if (poseModelLoaded && shouldProcessPose && videoRef.current) {
          // For pose detection, we need to use the video element
          // Create a temporary canvas with the image
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              
              const poseResult = await detectPose(canvas);
              setSOSProgress(poseResult.duration);

              if (poseResult.sosTriggered) {
                // SOS triggered - create alert
                const camera = cameras.find((c) => c.id === frame.cameraId);
                const alert = await createAlert(
                  "sos",
                  frame.cameraId,
                  camera?.name || "Unknown Camera",
                  frame.frame
                );
                if (alert) {
                  addAlert(alert);
                  setCampusStatus("alert");
                  setThreatActive(true);
                  resetSOSState();
                  
                  // Auto-reset threat after 5 seconds
                  setTimeout(() => setThreatActive(false), 5000);
                }
              }
            }
          }
        }

        // Update camera detections
        if (detections.length > 0 || shouldProcessFaces) {
          setCameras((prev) =>
            prev.map((cam) =>
              cam.id === frame.cameraId ? { ...cam, detections } : cam
            )
          );
        }
      };
    },
    [setCameras, faceModelLoaded, poseModelLoaded, detectFaces, detectPose, cameras, createAlert, addAlert, setCampusStatus, resetSOSState]
  );

  // Realtime stream connection
  const { isConnected } = useRealtimeStream({
    channelName: "camera-stream",
    onFrame: handleFrame,
  });

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || null;

  // Toggle dark mode
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  // Initialize dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const aiStatus = faceModelLoaded && poseModelLoaded ? "ready" : (isFaceLoading || isPoseLoading) ? "loading" : "offline";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hidden elements for AI processing */}
      <img ref={imageRef} className="hidden" alt="" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />
      <video ref={videoRef} className="hidden" />

      {/* Threat Alert Overlay */}
      <ThreatOverlay active={threatActive} />

      {/* Header */}
      <header className="flex items-center justify-between border-b bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AMU-Guard AI</h1>
            <p className="text-xs text-muted-foreground">Campus Security Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* FPS Counter */}
          <Badge variant="outline" className="gap-1 font-mono">
            <Activity className="h-3 w-3" />
            {actualFPS} FPS
          </Badge>

          {/* AI Status Badge */}
          <Badge
            variant={aiStatus === "ready" ? "default" : "secondary"}
            className="gap-1"
          >
            <Brain className="h-3 w-3" />
            {aiStatus === "loading" ? "Loading AI..." : aiStatus === "ready" ? `AI Ready (${knownFacesCount} faces)` : "AI Offline"}
          </Badge>

          {/* SOS Progress (if detecting) */}
          {sosProgress > 0 && sosProgress < 3000 && (
            <Badge variant="destructive" className="gap-1 animate-pulse">
              🆘 SOS: {((sosProgress / 3000) * 100).toFixed(0)}%
            </Badge>
          )}

          {/* Cloud Connection Status */}
          <Badge variant={isConnected ? "default" : "outline"} className="gap-1">
            {isConnected ? "☁️ Cloud Connected" : "⏳ Connecting..."}
          </Badge>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {alerts.filter((a) => !a.acknowledged).length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {alerts.filter((a) => !a.acknowledged).length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
          <QRCodePanel previewUrl={PREVIEW_URL} />
        </div>
      </header>

      {/* Status Banner */}
      <StatusBanner status={campusStatus} onReset={resetStatus} />

      {/* Main Content */}
      <div className="flex flex-1 gap-4 p-4">
        {/* Left Column - Camera Grid */}
        <div className="flex w-80 flex-col gap-4">
          {/* Camera Grid */}
          <div className="grid grid-cols-1 gap-3">
            {cameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                isSelected={camera.id === selectedCameraId}
                onClick={() => setSelectedCameraId(camera.id)}
              />
            ))}
          </div>
        </div>

        {/* Center - Live Feed Viewer */}
        <div className="flex-1">
          <LiveFeedViewer camera={selectedCamera} sosProgress={sosProgress} />
        </div>

        {/* Right Column - Event Log */}
        <div className="w-80">
          <EventLog events={alerts} onAcknowledge={acknowledgeAlert} />
        </div>
      </div>
    </div>
  );
}
