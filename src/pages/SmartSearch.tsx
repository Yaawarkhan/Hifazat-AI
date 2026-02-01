import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  ArrowLeft, 
  Play, 
  Pause, 
  Clock, 
  Send,
  Loader2,
  Video,
  Sparkles,
  AlertCircle,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SearchResult {
  id: string;
  timestamp: string;
  timeInVideo: number;
  description: string;
  confidence: number;
  matchedCriteria: string[];
  boundingBox?: BoundingBox;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  results?: SearchResult[];
  isLoading?: boolean;
}

interface VideoFrame {
  timestamp: number;
  data: string; // base64 data URL
}

export default function SmartSearch() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Welcome to Smart Search! I analyze actual video frames using AI vision to find what you're looking for.\n\n• \"Find a yellow taxi\"\n• \"Show me anyone wearing a red shirt\"\n• \"Find people walking in groups\"\n• \"Detect vehicles entering the frame\"\n\nClick any result to jump to that moment with a highlighted bounding box."
    }
  ]);
  const [isSearching, setIsSearching] = useState(false);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [activeBoundingBox, setActiveBoundingBox] = useState<BoundingBox | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Draw bounding box overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas size to video display size
    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw bounding box if active
    if (activeBoundingBox) {
      const x = (activeBoundingBox.x / 100) * canvas.width;
      const y = (activeBoundingBox.y / 100) * canvas.height;
      const width = (activeBoundingBox.width / 100) * canvas.width;
      const height = (activeBoundingBox.height / 100) * canvas.height;

      // Draw filled semi-transparent background
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(x, y, width, height);

      // Draw border
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw corner accents
      const cornerLength = Math.min(width, height) * 0.2;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLength);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLength, y);
      ctx.stroke();
      
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLength);
      ctx.stroke();
      
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLength);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLength, y + height);
      ctx.stroke();
      
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLength, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLength);
      ctx.stroke();

      // Add "DETECTED" label
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x, y - 24, 80, 22);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("DETECTED", x + 6, y - 8);
    }
  }, [activeBoundingBox, currentTime]);

  // Extract frames from video for AI analysis
  const extractFrames = useCallback(async (): Promise<VideoFrame[]> => {
    if (!videoRef.current || !canvasRef.current) {
      console.log("[SmartSearch] Video or canvas not available");
      return [];
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    // Ensure video is fully loaded
    if (video.readyState < 3) {
      console.log("[SmartSearch] Waiting for video data...", video.readyState);
      await new Promise<void>((resolve) => {
        const handler = () => {
          if (video.readyState >= 3) {
            video.removeEventListener("canplaythrough", handler);
            resolve();
          }
        };
        video.addEventListener("canplaythrough", handler);
        if (video.readyState >= 3) resolve();
        setTimeout(resolve, 3000); // Fallback
      });
    }

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (!videoWidth || !videoHeight) {
      console.error("[SmartSearch] Video dimensions unavailable");
      return [];
    }
    
    // Set canvas size
    canvas.width = 640;
    canvas.height = Math.round((640 / videoWidth) * videoHeight);

    console.log(`[SmartSearch] Canvas: ${canvas.width}x${canvas.height}, Video: ${videoWidth}x${videoHeight}, ReadyState: ${video.readyState}`);

    const frames: VideoFrame[] = [];
    const videoDuration = video.duration;
    
    if (!videoDuration || videoDuration <= 0 || !isFinite(videoDuration)) {
      console.error("[SmartSearch] Invalid video duration:", videoDuration);
      return [];
    }

    // Extract 20 frames spread across video
    const numFrames = 20;
    const frameInterval = videoDuration / numFrames;

    console.log(`[SmartSearch] Extracting ${numFrames} frames from ${videoDuration.toFixed(2)}s video`);

    // Save original state
    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;
    if (wasPlaying) video.pause();

    // Start from a small offset to avoid black intro frames
    const startOffset = 1;

    for (let i = 0; i < numFrames; i++) {
      const timestamp = Math.min(startOffset + i * frameInterval, videoDuration - 0.5);
      
      try {
        // Set the current time
        video.currentTime = timestamp;
        
        // Wait for the seeked event
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          };
          video.addEventListener("seeked", onSeeked);
          // Check if already at position
          if (Math.abs(video.currentTime - timestamp) < 0.5) {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          }
          setTimeout(() => {
            video.removeEventListener("seeked", onSeeked);
            resolve();
          }, 800);
        });
        
        // Wait for video to have decoded data ready
        await new Promise<void>(resolve => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            const onData = () => {
              video.removeEventListener("canplay", onData);
              resolve();
            };
            video.addEventListener("canplay", onData);
            setTimeout(() => {
              video.removeEventListener("canplay", onData);
              resolve();
            }, 300);
          }
        });
        
        // Extra delay to ensure frame is painted
        await new Promise(r => setTimeout(r, 150));

        // Clear and draw
        ctx.fillStyle = "#222222";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Try to draw the video
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (drawErr) {
          console.error(`[SmartSearch] Draw failed at ${timestamp}s:`, drawErr);
          continue;
        }
        
        // Sample center area to check brightness
        try {
          const centerX = Math.floor(canvas.width * 0.4);
          const centerY = Math.floor(canvas.height * 0.4);
          const sampleSize = 30;
          const imageData = ctx.getImageData(centerX, centerY, sampleSize, sampleSize);
          const pixels = imageData.data;
          
          let totalR = 0, totalG = 0, totalB = 0;
          for (let p = 0; p < pixels.length; p += 4) {
            totalR += pixels[p];
            totalG += pixels[p + 1];
            totalB += pixels[p + 2];
          }
          const pixelCount = pixels.length / 4;
          const avgBrightness = (totalR + totalG + totalB) / pixelCount / 3;
          
          console.log(`[SmartSearch] Frame ${i + 1}: time=${timestamp.toFixed(1)}s, brightness=${avgBrightness.toFixed(1)}`);
          
          // If too dark, try one more time
          if (avgBrightness < 10) {
            await new Promise(r => setTimeout(r, 250));
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } catch (sampleErr) {
          console.warn(`[SmartSearch] Canvas tainted at ${timestamp}s - CORS issue`);
        }
        
        // Add timestamp overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(8, 8, 90, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px monospace";
        ctx.fillText(formatTime(timestamp), 14, 28);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        
        if (dataUrl && dataUrl.length > 1000) {
          frames.push({ timestamp, data: dataUrl });
          console.log(`[SmartSearch] ✓ Frame ${i + 1}/${numFrames} at ${timestamp.toFixed(1)}s (${Math.round(dataUrl.length / 1024)}KB)`);
        } else {
          console.warn(`[SmartSearch] Frame ${i + 1} too small: ${dataUrl?.length || 0} bytes`);
        }
      } catch (err) {
        console.error(`[SmartSearch] Error at frame ${i + 1}:`, err);
      }
    }

    // Restore
    video.currentTime = originalTime;
    if (wasPlaying) video.play();

    console.log(`[SmartSearch] Extracted ${frames.length} frames total`);
    return frames;
  }, []);

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setVideoReady(true);
      console.log("[SmartSearch] Video loaded, duration:", videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        setActiveBoundingBox(null); // Clear box when playing
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekToTime = (time: number, boundingBox?: BoundingBox) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.pause();
      setIsPlaying(false);
      
      // Set bounding box after a short delay to ensure video has seeked
      if (boundingBox) {
        setTimeout(() => {
          setActiveBoundingBox(boundingBox);
        }, 100);
      } else {
        setActiveBoundingBox(null);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const queryToUse = searchQuery ?? query;
    if (!queryToUse.trim() || isSearching) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: queryToUse
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "Extracting video frames...",
      isLoading: true
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setQuery(searchQuery ?? "");
    setIsSearching(true);
    setActiveBoundingBox(null);

    try {
      // Extract frames from video
      setIsExtractingFrames(true);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: "Extracting video frames for AI analysis..." }
            : msg
        )
      );

      const frames = await extractFrames();
      setIsExtractingFrames(false);

      if (frames.length === 0) {
        throw new Error("Failed to extract video frames. Please ensure the video is loaded.");
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { ...msg, content: `Analyzing ${frames.length} frames with AI vision...` }
            : msg
        )
      );

      // Send frames to edge function for analysis
      const { data, error } = await supabase.functions.invoke("smart-search", {
        body: { 
          query: queryToUse,
          frames: frames,
          videoDuration: duration
        }
      });

      if (error) throw error;

      const results: SearchResult[] = data?.results || [];
      const aiResponse = data?.summary || "No matches found for your query.";

      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: aiResponse, 
                results: results,
                isLoading: false 
              }
            : msg
        )
      );
    } catch (err) {
      console.error("[SmartSearch] Error:", err);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : "Unknown error"}. Please try again.`, 
                isLoading: false 
              }
            : msg
        )
      );
      toast({
        title: "Search Error",
        description: "Failed to analyze footage. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
      setIsExtractingFrames(false);
    }
  }, [query, isSearching, duration, toast, extractFrames]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <header className="border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Smart Search</h1>
              <p className="text-xs text-muted-foreground">AI Vision-Powered Analysis</p>
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto gap-1">
            <Sparkles className="h-3 w-3" />
            AI Vision
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        {/* Video Player Section */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="h-4 w-4" />
              CCTV Footage
            </CardTitle>
            <CardDescription>Click results to jump to detected moments</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
              <video
                ref={videoRef}
                src="/footage/sample-cctv.mp4"
                className="w-full h-full object-contain"
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={handleVideoLoaded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* Bounding box overlay */}
              <canvas 
                ref={overlayCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {/* Video controls overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <div 
                    className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percent = (e.clientX - rect.left) / rect.width;
                      seekToTime(percent * duration);
                    }}
                  >
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs text-white font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
              {/* Frame extraction indicator */}
              {isExtractingFrames && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-white bg-black/70 px-4 py-2 rounded-lg">
                    <Camera className="h-5 w-5 animate-pulse" />
                    <span>Extracting frames...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Duration: {formatTime(duration)}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Video className="h-3 w-3" />
                {videoReady ? "Ready" : "Loading..."}
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                Demo Footage
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat/Search Section */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Natural Language Search
            </CardTitle>
            <CardDescription>AI analyzes actual video frames to find matches</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4 mb-3">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.isLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">{message.content}</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Search Results */}
                          {message.results && message.results.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <p className="text-xs font-medium opacity-70">Found {message.results.length} matches:</p>
                              {message.results.map((result) => (
                                <button
                                  key={result.id}
                                  onClick={() => seekToTime(result.timeInVideo, result.boundingBox)}
                                  className="w-full text-left p-2 rounded bg-background/50 hover:bg-background/80 transition-colors border border-transparent hover:border-primary/50"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono text-primary font-bold">
                                      ▶ {formatTime(result.timeInVideo)}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] h-5">
                                      {Math.round(result.confidence * 100)}% match
                                    </Badge>
                                  </div>
                                  <p className="text-xs">{result.description}</p>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {result.matchedCriteria.map((criteria, i) => (
                                      <Badge key={i} variant="secondary" className="text-[10px] h-4">
                                        {criteria}
                                      </Badge>
                                    ))}
                                  </div>
                                  {result.boundingBox && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      📍 Click to view with bounding box
                                    </p>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Describe what you're looking for..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSearching || !videoReady}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={!query.trim() || isSearching || !videoReady}
                size="icon"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Example Queries */}
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Try:</span>
              {[
                "Find a yellow taxi",
                "People crossing street",
                "Red vehicles"
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => handleSearch(example)}
                  disabled={isSearching || !videoReady}
                  className="text-xs px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
