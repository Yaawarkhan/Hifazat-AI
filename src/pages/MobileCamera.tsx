import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, Wifi, WifiOff, RefreshCw, Loader2, Zap, Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRealtimeStream } from "@/hooks/useRealtimeStream";

// Performance presets - balanced for both speed and quality
const FPS_PRESETS = {
  realtime: { fps: 60, quality: 0.35, resolution: 360, label: "⚡ Realtime" },
  fast: { fps: 45, quality: 0.45, resolution: 420, label: "Fast" },
  balanced: { fps: 30, quality: 0.55, resolution: 480, label: "Balanced" },
  quality: { fps: 20, quality: 0.7, resolution: 720, label: "HD Quality" },
} as const;

type FPSPreset = keyof typeof FPS_PRESETS;

export default function MobileCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const audioIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsCounterRef = useRef<number>(0);
  const sendingRef = useRef<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [frameCount, setFrameCount] = useState(0);
  const [actualFPS, setActualFPS] = useState(0);
  const [preset, setPreset] = useState<FPSPreset>("balanced");
  const [encodeTime, setEncodeTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const { isConnected, sendFrame, sendAudio } = useRealtimeStream({
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
          width: { ideal: Math.round(settings.resolution * 1.33), max: 1280 },
          height: { ideal: settings.resolution, max: 720 },
          frameRate: { ideal: 60, max: 60 },
        },
        audio: isAudioEnabled, // Enable audio for acoustic sentinel
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
        setIsStreaming(true);
      }

      // Setup audio analysis if audio is enabled
      if (isAudioEnabled && stream.getAudioTracks().length > 0) {
        setupAudioAnalysis(stream);
      }
    } catch (err) {
      setError("Camera/microphone access denied. Please allow permissions.");
      console.error("Camera error:", err);
    }
  }, [facingMode, preset, isAudioEnabled]);

  // Setup audio analysis for acoustic sentinel
  const setupAudioAnalysis = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzerRef.current = analyzer;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);

      // Start audio level monitoring and threat detection
      const processAudio = () => {
        if (!analyzerRef.current || !isConnected) return;

        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        analyzerRef.current.getByteFrequencyData(dataArray);

        // Calculate sound level
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const level = Math.min(100, (average / 255) * 100 * 2);
        setAudioLevel(level);

        // Analyze for threats (simplified YAMNet-style detection)
        const highFreqEnergy = dataArray.slice(400).reduce((a, b) => a + b, 0);
        const lowFreqEnergy = dataArray.slice(0, 100).reduce((a, b) => a + b, 0);
        
        // Detect potential screams (high frequency, high amplitude)
        const isHighPitched = highFreqEnergy > lowFreqEnergy * 0.8;
        const isLoud = level > 70;
        
        let isThreat = false;
        let threatClass: string | undefined;
        let confidence = 0;

        if (isLoud && isHighPitched) {
          isThreat = true;
          threatClass = "Scream/Shout";
          confidence = Math.min(0.95, 0.5 + (level / 100) * 0.4);
        } else if (level > 85) {
          // Very loud = possible explosion or bang
          isThreat = true;
          threatClass = "Loud Impact/Bang";
          confidence = Math.min(0.9, 0.4 + (level / 100) * 0.5);
        }

        // Send audio data to dashboard
        sendAudio({
          cameraId: "mobile-cam",
          level,
          isThreat,
          threatClass,
          confidence: isThreat ? confidence : undefined,
        });
      };

      // Process audio every 200ms
      audioIntervalRef.current = window.setInterval(processAudio, 200);
      console.log("[MobileCamera] Audio analysis started");
    } catch (err) {
      console.error("[MobileCamera] Audio setup failed:", err);
    }
  }, [isConnected, sendAudio]);

  // Stop camera
  const stopCamera = useCallback(() => {
    sendingRef.current = false;
    
    if (frameIntervalRef.current) {
      cancelAnimationFrame(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsSending(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
    setAudioLevel(0);
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
          <span className="font-semibold">Hifazat.ai Camera</span>
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
            {/* Audio Level Indicator */}
            {isAudioEnabled && audioLevel > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-card/80 px-3 py-1 text-xs">
                <Volume2 className="h-3 w-3 text-primary" />
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-100 ${audioLevel > 70 ? 'bg-status-alert' : 'bg-status-secure'}`}
                    style={{ width: `${audioLevel}%` }}
                  />
                </div>
                <span className="font-mono">{Math.round(audioLevel)}%</span>
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
          <p className="font-medium text-primary">📱 Hifazat.ai Mobile Camera</p>
          <p className="mt-1 text-muted-foreground">
            {isConnected
              ? "Connected! Your camera feed is being sent to the dashboard in real-time."
              : "Connecting to Hifazat.ai Cloud..."}
          </p>
          {isSending && (
            <>
              <p className="mt-1 text-status-secure">
                ✅ Streaming at {actualFPS} FPS • Frames: {frameCount} • {FPS_PRESETS[preset].resolution}p
              </p>
              {isAudioEnabled && (
                <p className="mt-1 text-primary">
                  🎤 Audio streaming enabled for Acoustic Sentinel
                </p>
              )}
            </>
          )}
        </div>

        {/* Audio Toggle */}
        {isStreaming && (
          <Button
            variant={isAudioEnabled ? "default" : "outline"}
            size="sm"
            className="w-full"
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
          >
            {isAudioEnabled ? (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Audio Streaming: ON
              </>
            ) : (
              <>
                <MicOff className="mr-2 h-4 w-4" />
                Audio Streaming: OFF
              </>
            )}
          </Button>
        )}

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
