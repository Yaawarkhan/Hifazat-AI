import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [frameCount, setFrameCount] = useState(0);

  const { isConnected, sendFrame } = useRealtimeStream({
    channelName: "camera-stream",
  });

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
    stopSending();
  };

  // Switch camera
  const switchCamera = () => {
    const wasStreaming = isStreaming;
    const wasSending = isSending;
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    
    // Restart after mode change
    setTimeout(async () => {
      if (wasStreaming) {
        await startCamera();
        if (wasSending) {
          startSending();
        }
      }
    }, 100);
  };

  // Start sending frames
  const startSending = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isConnected) return;

    setIsSending(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const captureAndSend = () => {
      if (!video || video.readyState !== 4) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0);

      // Convert to base64 JPEG with reduced quality for faster streaming
      const frameData = canvas.toDataURL("image/jpeg", 0.6);
      sendFrame("mobile-cam", frameData);
      setFrameCount((prev) => prev + 1);
    };

    // Send frames at ~8 FPS for smooth streaming
    frameIntervalRef.current = window.setInterval(captureAndSend, 125);
  }, [isConnected, sendFrame]);

  // Stop sending frames
  const stopSending = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsSending(false);
  };

  // Auto-start sending when connected and streaming
  useEffect(() => {
    if (isConnected && isStreaming && !isSending) {
      startSending();
    }
  }, [isConnected, isStreaming, isSending, startSending]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
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
              <Loader2 className="h-4 w-4 animate-spin" /> Connecting...
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

        {isStreaming && isSending && (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE • {frameCount} frames
          </div>
        )}

        {isStreaming && !isConnected && (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-yellow-500 px-3 py-1 text-sm font-medium text-white">
            <Loader2 className="h-3 w-3 animate-spin" />
            Connecting to Cloud...
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

        {/* Status Info */}
        <div className="rounded-lg bg-muted/30 p-3 text-xs">
          <p className="font-medium text-primary">📱 Streaming via Cloud</p>
          <p className="mt-1 text-muted-foreground">
            {isConnected
              ? "Connected! Your camera feed is being sent to the dashboard."
              : "Connecting to Lovable Cloud..."}
          </p>
          {isSending && (
            <p className="mt-1 text-green-500">
              ✅ Streaming at ~8 FPS • Frames sent: {frameCount}
            </p>
          )}
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

        {isStreaming && !isSending && isConnected && (
          <Button onClick={startSending} className="w-full" variant="default">
            <Wifi className="mr-2 h-4 w-4" />
            Start Streaming
          </Button>
        )}

        {isSending && (
          <Button onClick={stopSending} className="w-full" variant="destructive">
            <WifiOff className="mr-2 h-4 w-4" />
            Stop Streaming
          </Button>
        )}
      </div>
    </div>
  );
}
