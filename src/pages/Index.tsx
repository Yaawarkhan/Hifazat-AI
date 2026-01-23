import { useState, useCallback, useRef, useEffect } from "react";
import { Shield, Settings, Bell, Moon, Sun, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { CameraCard } from "@/components/dashboard/CameraCard";
import { LiveFeedViewer } from "@/components/dashboard/LiveFeedViewer";
import { EventLog } from "@/components/dashboard/EventLog";
import { QRCodePanel } from "@/components/dashboard/QRCodePanel";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { useDemoMode } from "@/hooks/useWebSocket";
import type { CameraFeed, Detection } from "@/types/detection";
import { Badge } from "@/components/ui/badge";

const PREVIEW_URL = "https://id-preview--704dc477-74cd-4433-8298-df359598f7bb.lovable.app";

export default function Index() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>("mobile-cam");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Demo mode for UI testing
  const {
    cameras,
    setCameras,
    alerts,
    addAlert,
    acknowledgeAlert,
    campusStatus,
    resetStatus,
  } = useDemoMode();

  // Face recognition
  const { isModelLoaded, isLoading: isFaceLoading, detectFaces, knownFacesCount } = useFaceRecognition();

  // Handle incoming frames from mobile camera
  const handleFrame = useCallback(
    async (frame: { cameraId: string; frame: string; timestamp: number }) => {
      // Update camera with new frame
      setCameras((prev) =>
        prev.map((cam) =>
          cam.id === frame.cameraId
            ? { ...cam, lastFrame: frame.frame, status: "online" as const }
            : cam
        )
      );

      // Run face detection if model is loaded
      if (isModelLoaded && imageRef.current) {
        imageRef.current.src = frame.frame;
        imageRef.current.onload = async () => {
          if (!imageRef.current) return;
          
          const faces = await detectFaces(imageRef.current);
          
          // Convert face detections to Detection format
          const detections: Detection[] = faces.map((face) => ({
            id: face.id,
            class: "face" as const,
            label: "Face",
            confidence: face.confidence,
            personName: face.name,
            boundingBox: face.boundingBox,
            timestamp: Date.now(),
          }));

          // Update camera detections
          setCameras((prev) =>
            prev.map((cam) =>
              cam.id === frame.cameraId ? { ...cam, detections } : cam
            )
          );
        };
      }
    },
    [setCameras, isModelLoaded, detectFaces]
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hidden elements for face detection */}
      <img ref={imageRef} className="hidden" alt="" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />

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
          {/* AI Status Badge */}
          <Badge
            variant={isModelLoaded ? "default" : "secondary"}
            className="gap-1"
          >
            <Brain className="h-3 w-3" />
            {isFaceLoading ? "Loading AI..." : isModelLoaded ? `AI Ready (${knownFacesCount} faces)` : "AI Offline"}
          </Badge>

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
          <LiveFeedViewer camera={selectedCamera} />
        </div>

        {/* Right Column - Event Log */}
        <div className="w-80">
          <EventLog events={alerts} onAcknowledge={acknowledgeAlert} />
        </div>
      </div>
    </div>
  );
}
