import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Settings, Bell, Moon, Sun, Brain, Activity, AlertTriangle, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { CameraCard } from "@/components/dashboard/CameraCard";
import { LiveFeedViewer } from "@/components/dashboard/LiveFeedViewer";
import { EventLog } from "@/components/dashboard/EventLog";
import { QRCodePanel } from "@/components/dashboard/QRCodePanel";
import { ThreatOverlay } from "@/components/dashboard/ThreatOverlay";
import { CampusMap } from "@/components/dashboard/CampusMap";
import { SoundLevelMeter } from "@/components/dashboard/SoundLevelMeter";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useThreatDetection } from "@/hooks/useThreatDetection";
import { useWeaponDetection } from "@/hooks/useWeaponDetection";
import { useAudioDetection } from "@/hooks/useAudioDetection";
import { useDemoMode } from "@/hooks/useWebSocket";
import type { CameraFeed, Detection, CampusStatus } from "@/types/detection";
import { Badge } from "@/components/ui/badge";

const PREVIEW_URL = "https://id-preview--704dc477-74cd-4433-8298-df359598f7bb.lovable.app";

// Ultra-optimized performance settings
const FACE_DETECTION_SKIP = 12; // Run face detection every 12th frame
const POSE_DETECTION_SKIP = 6; // Run pose detection every 6th frame
const WEAPON_DETECTION_SKIP = 8; // Run weapon detection every 8th frame

export default function Index() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>("mobile-cam");
  const [threatActive, setThreatActive] = useState(false);
  const [sosProgress, setSOSProgress] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [threatLocations, setThreatLocations] = useState<{ cameraId: string; active: boolean }[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const frameCounterRef = useRef(0);
  const fpsCounterRef = useRef(0);
  const lastFPSUpdateRef = useRef(Date.now());
  const processingRef = useRef(false);

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
  
  // Audio detection for Phase 3
  const handleAudioThreat = useCallback((result: { topClass: string; confidence: number; isThreat: boolean }) => {
    if (result.isThreat) {
      addAlert({
        type: "sound",
        message: `🔊 SOUND ALERT: ${result.topClass} detected (${(result.confidence * 100).toFixed(0)}% confidence)`,
        cameraId: selectedCameraId || "mobile-cam",
        cameraName: cameras.find((c) => c.id === selectedCameraId)?.name || "Audio Sensor",
        snapshot: undefined,
      });
      setCampusStatus("alert");
      setThreatActive(true);
      setTimeout(() => setThreatActive(false), 5000);
    }
  }, [addAlert, setCampusStatus, selectedCameraId, cameras]);

  const { 
    isListening, 
    soundLevel, 
    lastPrediction,
    startListening,
    stopListening,
    simulateThreat: simulateAudioThreat,
  } = useAudioDetection({
    enabled: audioEnabled,
    onThreatDetected: handleAudioThreat,
  });

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

  // Process frames with AI - ultra optimized
  const processFrameWithAI = useCallback(
    async (frameData: string, cameraId: string) => {
      if (!imageRef.current || !canvasRef.current) return;
      if (processingRef.current) return; // Skip if already processing

      processingRef.current = true;
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
                  setThreatLocations((prev) => [
                    ...prev.filter((t) => t.cameraId !== cameraId),
                    { cameraId, active: true },
                  ]);
                  setTimeout(() => {
                    setThreatActive(false);
                    setThreatLocations((prev) => 
                      prev.filter((t) => t.cameraId !== cameraId)
                    );
                  }, 10000);
                }

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

          processingRef.current = false;
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

  // Handle incoming frames - immediate display, async processing
  const handleFrame = useCallback(
    (frame: { cameraId: string; frame: string; timestamp: number }) => {
      fpsCounterRef.current++;
      frameCounterRef.current++;

      // Update camera frame IMMEDIATELY (zero delay)
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
    simulateWeaponDetection();
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
      setThreatLocations([{ cameraId: selectedCameraId || "mobile-cam", active: true }]);
      setTimeout(() => {
        setThreatActive(false);
        setThreatLocations([]);
      }, 5000);
    }
  }, [simulateWeaponDetection, cameras, selectedCameraId, selectedCamera, createAlert, addAlert, setCampusStatus]);

  // Toggle audio detection
  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => !prev);
  }, []);

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
      <header className="flex items-center justify-between border-b bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">AMU-Guard AI</h1>
            <p className="text-[10px] text-muted-foreground">Security Command Center</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Performance Stats */}
          <Badge variant="outline" className="gap-1 font-mono text-xs h-6">
            <Activity className="h-3 w-3" />
            {actualFPS} FPS
          </Badge>

          {/* AI Status Badge */}
          <Badge
            variant={aiStatus === "ready" ? "default" : "secondary"}
            className="gap-1 text-xs h-6"
          >
            <Brain className="h-3 w-3" />
            {aiStatus === "loading" ? "Loading..." : aiStatus === "ready" ? `AI (${knownFacesCount})` : "Offline"}
          </Badge>

          {/* Cloud Connection Status */}
          <Badge variant={isConnected ? "default" : "outline"} className="gap-1 text-xs h-6">
            {isConnected ? "☁️ Live" : "⏳ ..."}
          </Badge>

          {/* Test Buttons */}
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleTestWeaponAlert}
            className="gap-1 h-6 px-2 text-xs"
          >
            <AlertTriangle className="h-3 w-3" />
            Test
          </Button>

          <Button 
            variant="secondary" 
            size="sm" 
            onClick={simulateAudioThreat}
            className="gap-1 h-6 px-2 text-xs"
          >
            <Volume2 className="h-3 w-3" />
            Sound
          </Button>

          <Button variant="ghost" size="icon" className="relative h-7 w-7">
            <Bell className="h-4 w-4" />
            {alerts.filter((a) => !a.acknowledged).length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {alerts.filter((a) => !a.acknowledged).length}
              </span>
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Settings className="h-4 w-4" />
          </Button>
          <QRCodePanel previewUrl={PREVIEW_URL} />
        </div>
      </header>

      {/* Status Banner */}
      <StatusBanner status={campusStatus} onReset={resetStatus} />

      {/* Main Content - Clean Grid Layout */}
      <div className="flex-1 p-3 grid grid-cols-12 gap-3">
        {/* Left Sidebar - Cameras & Map */}
        <div className="col-span-3 space-y-3">
          {/* Campus Map */}
          <CampusMap
            cameras={cameras}
            selectedCameraId={selectedCameraId}
            onCameraSelect={setSelectedCameraId}
            campusStatus={campusStatus}
            threatLocations={threatLocations}
          />
          
          {/* Sound Level Meter */}
          <SoundLevelMeter
            level={soundLevel}
            isListening={isListening}
            lastPrediction={lastPrediction}
            onToggle={handleToggleAudio}
          />

          {/* Camera Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-muted-foreground px-1">CAMERAS</h3>
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
        <div className="col-span-6">
          <LiveFeedViewer camera={selectedCamera} sosProgress={sosProgress} />
        </div>

        {/* Right Sidebar - Event Log */}
        <div className="col-span-3">
          <EventLog events={alerts} onAcknowledge={acknowledgeAlert} />
        </div>
      </div>
    </div>
  );
}
