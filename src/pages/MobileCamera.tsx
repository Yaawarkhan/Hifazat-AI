import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";

// Zero-latency performance presets - prioritizing speed over quality
const FPS_PRESETS = {
  realtime: { fps: 60, quality: 0.25, resolution: 240, label: "⚡ Realtime" },
  fast: { fps: 45, quality: 0.3, resolution: 280, label: "Fast" },
  balanced: { fps: 30, quality: 0.4, resolution: 320, label: "Balanced" },
  quality: { fps: 20, quality: 0.5, resolution: 400, label: "Quality" },
} as const;

type FPSPreset = keyof typeof FPS_PRESETS;

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsCounterRef = useRef<number>(0);
  const sendingRef = useRef<boolean>(false);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [frameCount, setFrameCount] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  const [preset, setPreset] = useState<FPSPreset>("realtime");
  const [encodeTime, setEncodeTime] = useState(0);
  const [latency, setLatency] = useState(0);

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

  // Pre-create canvas context for performance
  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext("2d", { 
        alpha: false,
        desynchronized: true,
      });
    }
  }, []);

  // Get camera stream with optimized settings
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const settings = FPS_PRESETS[preset];
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: Math.round(settings.resolution * 1.33), max: 640 },
          height: { ideal: settings.resolution, max: 480 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        setIsStreaming(true);
      }
    } catch (err) {
      setError("Camera access denied. Please allow camera permissions.");
      console.error("Camera error:", err);
    }
  }, [facingMode, preset]);

  // Stop camera
  const stopCamera = useCallback(() => {
    sendingRef.current = false;
    if (frameIntervalRef.current) {
      cancelAnimationFrame(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsSending(false);

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    const wasStreaming = isStreaming;
    const wasSending = sendingRef.current;
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));

    setTimeout(async () => {
      if (wasStreaming) {
        await startCamera();
      }
    }, 100);
  }, [isStreaming, stopCamera, startCamera]);

  // Ultra-high-performance frame capture
  const startSending = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isConnected) return;
    if (sendingRef.current) return; // Prevent double-start

    setIsSending(true);
    sendingRef.current = true;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current || canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const settings = FPS_PRESETS[preset];
    const frameInterval = 1000 / settings.fps;

    // Pre-set canvas size once
    const targetWidth = Math.round(settings.resolution * 1.33);
    const targetHeight = settings.resolution;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const captureFrame = (timestamp: number) => {
      if (!sendingRef.current) return;
      
      if (!video || video.readyState !== 4) {
        frameIntervalRef.current = requestAnimationFrame(captureFrame);
        return;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameInterval) {
        lastFrameTimeRef.current = timestamp - (elapsed % frameInterval);
        const encodeStart = performance.now();

        // Draw and encode
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        const frameData = canvas.toDataURL("image/jpeg", settings.quality);
        
        // Send without waiting (fire and forget)
        sendFrame("mobile-cam", frameData);
        
        // Track metrics (update less frequently for performance)
        frameCountRef.current++;
        fpsCounterRef.current++;
        
        if (frameCountRef.current % 15 === 0) {
          setFrameCount(frameCountRef.current);
          setEncodeTime(Math.round(performance.now() - encodeStart));
        }
      }

      frameIntervalRef.current = requestAnimationFrame(captureFrame);
    };

    lastFrameTimeRef.current = performance.now();
    frameIntervalRef.current = requestAnimationFrame(captureFrame);
  }, [isConnected, sendFrame, preset]);

  // Stop sending frames
  const stopSending = useCallback(() => {
    sendingRef.current = false;
    if (frameIntervalRef.current) {
      cancelAnimationFrame(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    setIsSending(false);
  }, []);

  // Auto-start sending when connected and streaming
  useEffect(() => {
    if (isConnected && isStreaming && !sendingRef.current) {
      startSending();
    }
  }, [isConnected, isStreaming, startSending]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Restart streaming when preset changes
  useEffect(() => {
    if (sendingRef.current) {
      stopSending();
      setTimeout(() => startSending(), 50);
    }
  }, [preset, stopSending, startSending]);

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
            <span className="flex items-center gap-1 text-sm text-status-secure">
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
      <div className="relative flex-1 bg-muted">
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
            <div className="text-center text-muted-foreground">
              <CameraOff className="mx-auto h-16 w-16 opacity-50" />
              <p className="mt-2 text-sm opacity-75">Camera not active</p>
            </div>
          </div>
        )}

        {isStreaming && isSending && (
          <div className="absolute left-4 top-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-full bg-destructive px-3 py-1 text-sm font-medium text-destructive-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive-foreground" />
              LIVE
            </div>
            <div className="flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-sm font-medium text-status-secure">
              <Zap className="h-3 w-3" />
              {actualFPS} FPS
            </div>
            {encodeTime > 0 && (
              <div className="rounded-full bg-card/80 px-3 py-1 text-xs text-muted-foreground">
                Encode: {encodeTime}ms
              </div>
            )}
          </div>
        )}

        {isStreaming && !isConnected && (
          <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-status-alert px-3 py-1 text-sm font-medium text-foreground">
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
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(FPS_PRESETS) as FPSPreset[]).map((p) => (
              <Button
                key={p}
                variant={preset === p ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(p)}
              >
                {FPS_PRESETS[p].label}
              </Button>
            ))}
          </div>
        )}

        {/* Status Info */}
        <div className="rounded-lg bg-muted/30 p-3 text-xs">
          <p className="font-medium text-primary">📱 Ultra-Low Latency Streaming</p>
          <p className="mt-1 text-muted-foreground">
            {isConnected
              ? "Connected! Your camera feed is being sent to the dashboard in real-time."
              : "Connecting to Lovable Cloud..."}
          </p>
          {isSending && (
            <p className="mt-1 text-status-secure">
              ✅ Streaming at {actualFPS} FPS • Frames: {frameCount} • {FPS_PRESETS[preset].resolution}p
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
