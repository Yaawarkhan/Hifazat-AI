import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState("ws://192.168.1.100:8000/ws/mobile");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  // Get camera stream
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.");
      console.error("Camera error:", err);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  };

  // Switch camera
  const switchCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  useEffect(() => {
    if (isStreaming) {
      startCamera();
    }
  }, [facingMode]);

  // Connect to backend WebSocket
  const connectToBackend = () => {
    try {
      setError(null);
      wsRef.current = new WebSocket(backendUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        startFrameCapture();
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
      };
      
      wsRef.current.onerror = () => {
        setError("Failed to connect to backend");
        setIsConnected(false);
      };
    } catch (err) {
      setError("Invalid WebSocket URL");
    }
  };

  // Disconnect from backend
  const disconnectFromBackend = () => {
    wsRef.current?.close();
    setIsConnected(false);
  };

  // Capture and send frames
  const startFrameCapture = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const captureFrame = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      ctx.drawImage(video, 0, 0);
      
      // Convert to base64 and send
      const frameData = canvas.toDataURL("image/jpeg", 0.7);
      wsRef.current.send(
        JSON.stringify({
          type: "frame",
          cameraId: "mobile-cam",
          data: frameData,
        })
      );
      
      // Send at ~10 FPS
      requestAnimationFrame(() => {
        setTimeout(captureFrame, 100);
      });
    };
    
    captureFrame();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      disconnectFromBackend();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Camera className="h-6 w-6 text-primary" />
          <span className="font-semibold">Mobile Camera</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1 text-sm text-green-500">
              <Wifi className="h-4 w-4" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4" /> Disconnected
            </span>
          )}
        </div>
      </header>

      {/* Video Preview */}
      <div className="relative flex-1 bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {!isStreaming && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white">
              <CameraOff className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-2 text-sm opacity-75">Camera not active</p>
            </div>
          </div>
        )}
        
        {isStreaming && isConnected && (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4 border-t border-border bg-card p-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {/* Backend URL Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Backend URL</label>
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="ws://192.168.1.100:8000/ws/mobile"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground">
            Enter your computer's local IP address (find it with `ipconfig` or `ifconfig`)
          </p>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {!isStreaming ? (
            <Button onClick={startCamera} className="col-span-2">
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={stopCamera}>
                <CameraOff className="mr-2 h-4 w-4" />
                Stop Camera
              </Button>
              <Button variant="outline" onClick={switchCamera}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Switch Camera
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!isConnected ? (
            <Button
              onClick={connectToBackend}
              disabled={!isStreaming}
              className="col-span-2"
              variant="default"
            >
              <Wifi className="mr-2 h-4 w-4" />
              Connect to Backend
            </Button>
          ) : (
            <Button
              onClick={disconnectFromBackend}
              variant="destructive"
              className="col-span-2"
            >
              <WifiOff className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
