import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Settings, Bell, Moon, Sun, Brain, Activity, AlertTriangle } from "lucide-react";
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
import { useWeaponDetection } from "@/hooks/useWeaponDetection";
import { useDemoMode } from "@/hooks/useWebSocket";
import type { CameraFeed, Detection, CampusStatus } from "@/types/detection";
import { Badge } from "@/components/ui/badge";

const PREVIEW_URL = "https://id-preview--704dc477-74cd-4433-8298-df359598f7bb.lovable.app";

// Performance settings - optimized for low latency
const FACE_DETECTION_SKIP = 8; // Run face detection every Nth frame (less frequent = faster)
const POSE_DETECTION_SKIP = 4; // Run pose detection every Nth frame
const WEAPON_DETECTION_SKIP = 6; // Run weapon detection every Nth frame

export default function Index() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>("mobile-cam");
  const [threatActive, setThreatActive] = useState(false);
  const [sosProgress, setSOSProgress] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  const [processingLoad, setProcessingLoad] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameCounterRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const lastFPSUpdateRef = useRef(Date.now());
  const processingRef = useRef(false);
  const frameQueueRef = useRef<string | null>(null);

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

  // AI Hooks
  const { isModelLoaded: faceModelLoaded, isLoading: isFaceLoading, detectFaces, knownFacesCount } = useFaceRecognition();
  const { isModelLoaded: poseModelLoaded, isLoading: isPoseLoading, detectPose, resetSOSState } = usePoseDetection();
  const { createAlert, processThreats } = useThreatDetection();
  const { isModelLoaded: weaponModelLoaded, isLoading: isWeaponLoading, detectWeapons, simulateWeaponDetection } = useWeaponDetection();

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

  // Process frames with AI - non-blocking
  const processFrameWithAI = useCallback(
    async (frameData: string, cameraId: string) => {
      if (!imageRef.current || !canvasRef.current) return;
      if (processingRef.current) {
        // Queue the latest frame, skip intermediate ones
        frameQueueRef.current = frameData;
        return;
      }

      processingRef.current = true;
      const processStart = performance.now();

      const img = imageRef.current;
      
      return new Promise<void>((resolve) => {
        img.onload = async () => {
          let detections: Detection[] = [];
          const frameNum = frameCounterRef.current;

          try {
            // Run face detection (heavily throttled)
            if (faceModelLoaded && frameNum % FACE_DETECTION_SKIP === 0) {
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
            if (poseModelLoaded && frameNum % POSE_DETECTION_SKIP === 0) {
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
                    const camera = cameras.find((c) => c.id === cameraId);
                    const alert = await createAlert(
                      "sos",
                      cameraId,
                      camera?.name || "Unknown Camera",
                      frameData
                    );
                    if (alert) {
                      addAlert(alert);
                      setCampusStatus("alert");
                      setThreatActive(true);
                      resetSOSState();
                      setTimeout(() => setThreatActive(false), 5000);
                    }
                  }
                }
              }
            }

            // Run weapon detection (throttled)
            if (weaponModelLoaded && frameNum % WEAPON_DETECTION_SKIP === 0) {
              const weaponDetections = await detectWeapons(img);
              
              if (weaponDetections.length > 0) {
                const camera = cameras.find((c) => c.id === cameraId);
                const alert = await createAlert(
                  "weapon",
                  cameraId,
                  camera?.name || "Unknown Camera",
                  frameData
                );
                if (alert) {
                  addAlert(alert);
                  setCampusStatus("lockdown");
                  setThreatActive(true);
                  setTimeout(() => setThreatActive(false), 10000);
                }

                // Add weapon detections to the list
                detections.push(...weaponDetections.map(w => ({
                  id: w.id,
                  class: "threat" as const,
                  label: w.class,
                  confidence: w.confidence,
                  boundingBox: w.boundingBox,
                  timestamp: Date.now(),
                })));
              }
            }

            // Update camera detections
            if (detections.length > 0) {
              setCameras((prev) =>
                prev.map((cam) =>
                  cam.id === cameraId ? { ...cam, detections } : cam
                )
              );
            }
          } catch (err) {
            console.error("[AI] Processing error:", err);
          }

          // Track processing load
          setProcessingLoad(Math.round(performance.now() - processStart));
          processingRef.current = false;

          // Process queued frame if any
          if (frameQueueRef.current) {
            const nextFrame = frameQueueRef.current;
            frameQueueRef.current = null;
            processFrameWithAI(nextFrame, cameraId);
          }

          resolve();
        };

        img.onerror = () => {
          processingRef.current = false;
          resolve();
        };

        img.src = frameData;
      });
    },
    [faceModelLoaded, poseModelLoaded, weaponModelLoaded, detectFaces, detectPose, detectWeapons, cameras, createAlert, addAlert, setCampusStatus, resetSOSState, setCameras]
  );

  // Handle incoming frames - optimized for speed
  const handleFrame = useCallback(
    (frame: { cameraId: string; frame: string; timestamp: number }) => {
      fpsCounterRef.current++;
      frameCounterRef.current++;

      // Update camera frame immediately (don't wait for AI)
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === frame.cameraId
            ? { ...cam, lastFrame: frame.frame, status: "online" as const }
            : cam
        )
      );

      // Process AI in background (non-blocking)
      processFrameWithAI(frame.frame, frame.cameraId);
    },
    [setCameras, processFrameWithAI]
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

  // Simulate weapon detection for testing
  const handleTestWeaponAlert = useCallback(async () => {
    const weapon = simulateWeaponDetection();
    const camera = cameras.find((c) => c.id === selectedCameraId);
    const alert = await createAlert(
      "weapon",
      selectedCameraId || "mobile-cam",
      camera?.name || "Mobile Camera",
      selectedCamera?.lastFrame
    );
    if (alert) {
      addAlert(alert);
      setCampusStatus("lockdown");
      setThreatActive(true);
      setTimeout(() => setThreatActive(false), 5000);
    }
  }, [simulateWeaponDetection, cameras, selectedCameraId, selectedCamera, createAlert, addAlert, setCampusStatus]);

  const aiStatus = (faceModelLoaded && poseModelLoaded && weaponModelLoaded) 
    ? "ready" 
    : (isFaceLoading || isPoseLoading || isWeaponLoading) 
    ? "loading" 
    : "offline";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hidden elements for AI processing */}
      <img ref={imageRef} className="hidden" alt="" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />

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
          {/* Performance Stats */}
          <Badge variant="outline" className="gap-1 font-mono">
            <Activity className="h-3 w-3" />
            {actualFPS} FPS
          </Badge>

          {processingLoad > 0 && (
            <Badge variant="outline" className="gap-1 font-mono text-xs">
              AI: {processingLoad}ms
            </Badge>
          )}

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

          {/* Test Weapon Alert Button */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleTestWeaponAlert}
            className="gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            Test Alert
          </Button>

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
