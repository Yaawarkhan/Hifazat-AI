import { useState, useCallback } from "react";
import { Shield, Settings, Bell, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/dashboard/StatusBanner";
import { CameraCard } from "@/components/dashboard/CameraCard";
import { LiveFeedViewer } from "@/components/dashboard/LiveFeedViewer";
import { EventLog } from "@/components/dashboard/EventLog";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { QRCodePanel } from "@/components/dashboard/QRCodePanel";
import { useWebSocket, useDemoMode } from "@/hooks/useWebSocket";
import type { WebSocketMessage, CameraFeed } from "@/types/detection";

const PREVIEW_URL = "https://id-preview--704dc477-74cd-4433-8298-df359598f7bb.lovable.app";

const BACKEND_URL = "ws://localhost:8000/ws";

export default function Index() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>("cam-1");

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

  // WebSocket connection to Python backend
  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      switch (message.type) {
        case "frame":
          setCameras((prev) =>
            prev.map((cam) =>
              cam.id === message.cameraId
                ? { ...cam, lastFrame: message.data as string }
                : cam
            )
          );
          break;
        case "detection":
          setCameras((prev) =>
            prev.map((cam) =>
              cam.id === message.cameraId
                ? { ...cam, detections: message.data as CameraFeed["detections"] }
                : cam
            )
          );
          break;
        case "alert":
          const alertData = message.data as {
            type: "threat" | "sos" | "sound" | "intrusion";
            message: string;
            snapshot?: string;
          };
          addAlert({
            type: alertData.type,
            message: alertData.message,
            cameraId: message.cameraId,
            cameraName: cameras.find((c) => c.id === message.cameraId)?.name || "Unknown",
            snapshot: alertData.snapshot,
          });
          break;
      }
    },
    [setCameras, addAlert, cameras]
  );

  const { isConnected, isConnecting, error, connect, disconnect } = useWebSocket({
    url: BACKEND_URL,
    onMessage: handleMessage,
  });

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) || null;

  // Toggle dark mode
  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  // Initialize dark mode
  useState(() => {
    document.documentElement.classList.add("dark");
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
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
        {/* Left Column - Camera Grid & Event Log */}
        <div className="flex w-80 flex-col gap-4">
          {/* Connection Status */}
          <ConnectionStatus
            isConnected={isConnected}
            isConnecting={isConnecting}
            error={error}
            backendUrl={BACKEND_URL}
            onConnect={connect}
            onDisconnect={disconnect}
          />

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
