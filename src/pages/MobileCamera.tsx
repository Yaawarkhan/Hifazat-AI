import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";

// Performance presets
const FPS_PRESETS = {
  low: { fps: 10, quality: 0.4, label: "Low (10 FPS)" },
  medium: { fps: 20, quality: 0.5, label: "Medium (20 FPS)" },
  high: { fps: 30, quality: 0.6, label: "High (30 FPS)" },
} as const;

type FPSPreset = keyof typeof FPS_PRESETS;

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsCounterRef = useRef<number>(0);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [frameCount, setFrameCount] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  const [preset, setPreset] = useState<FPSPreset>("high");

  const { isConnected, sendFrame } = useRealtimeStream({
    channelName: "camera-stream",
  });

  // Calculate actual FPS
  useEffect(() => {
    const interval = setInterval(() => {
      setActualFPS(fpsCounterRef.current);
      fpsCounterRef.current = 0;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get camera stream with optimized settings
  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 },
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

    setTimeout(async () => {
      if (wasStreaming) {
        await startCamera();
        if (wasSending) {
          startSending();
        }
      }
    }, 100);
  };

  // High-performance frame capture using requestAnimationFrame
  const startSending = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isConnected) return;

    setIsSending(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const settings = FPS_PRESETS[preset];
    const frameInterval = 1000 / settings.fps;

    const captureFrame = () => {
      if (!video || video.readyState !== 4 || !isSending) {
        frameIntervalRef.current = requestAnimationFrame(captureFrame);
        return;
      }

      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;

      if (elapsed >= frameInterval) {
        lastFrameTimeRef.current = now - (elapsed % frameInterval);

        // Use smaller resolution for faster encoding
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.min(video.videoHeight, 480);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Encode and send
        const frameData = canvas.toDataURL("image/jpeg", settings.quality);
        sendFrame("mobile-cam", frameData);
        
        frameCountRef.current++;
        fpsCounterRef.current++;
        setFrameCount(frameCountRef.current);
      }

      frameIntervalRef.current = requestAnimationFrame(captureFrame);
    };

    frameIntervalRef.current = requestAnimationFrame(captureFrame);
  }, [isConnected, sendFrame, preset, isSending]);

  // Stop sending frames
  const stopSending = useCallback(() => {
    if (frameIntervalRef.current) {
      cancelAnimationFrame(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsSending(false);
  }, []);

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

  // Restart streaming when preset changes
  useEffect(() => {
    if (isSending) {
      stopSending();
      setTimeout(() => startSending(), 50);
    }
  }, [preset]);

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
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-sm font-medium text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              LIVE
            </div>
            <div className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-green-400">
              <Zap className="h-3 w-3" />
              {actualFPS} FPS
            </div>
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

        {/* FPS Preset Selector */}
        {isStreaming && (
          <div className="flex gap-2">
            {(Object.keys(FPS_PRESETS) as FPSPreset[]).map((p) => (
              <Button
                key={p}
                variant={preset === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p)}
                className="flex-1"
              >
                {FPS_PRESETS[p].label}
              </Button>
            ))}
          </div>
        )}

        {/* Status Info */}
        <div className="rounded-lg bg-muted/30 p-3 text-xs">
          <p className="font-medium text-primary">📱 High-Performance Streaming</p>
          <p className="mt-1 text-muted-foreground">
            {isConnected
              ? "Connected! Your camera feed is being sent to the dashboard."
              : "Connecting to Lovable Cloud..."}
          </p>
          {isSending && (
            <p className="mt-1 text-green-500">
              ✅ Streaming at {actualFPS} FPS • Frames: {frameCount}
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
