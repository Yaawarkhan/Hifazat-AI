import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Maximize2, Minimize2, ZoomIn, ZoomOut, Video, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CameraFeed, Detection } from "@/types/detection";
import { cn } from "@/lib/utils";

interface LiveFeedViewerProps {
  camera: CameraFeed | null;
  sosProgress?: number;
}

export function LiveFeedViewer({ camera, sosProgress = 0 }: LiveFeedViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Zoom in handler
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 4));
  }, []);

  // Zoom out handler
  const handleZoomOut = useCallback(() => {
    setZoom((prev) => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) {
        setPanPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
  }, []);

  // Reset zoom and pan
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Toggle fullscreen
  const handleToggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Pan handling for zoomed view
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    isDraggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, [zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || zoom <= 1) return;

    const deltaX = e.clientX - lastPosRef.current.x;
    const deltaY = e.clientY - lastPosRef.current.y;

    setPanPosition((prev) => ({
      x: Math.max(-200, Math.min(200, prev.x + deltaX)),
      y: Math.max(-200, Math.min(200, prev.y + deltaY)),
    }));

    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, [zoom]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") handleZoomIn();
      if (e.key === "-") handleZoomOut();
      if (e.key === "0") handleResetZoom();
      if (e.key === "f" || e.key === "F") handleToggleFullscreen();
      if (e.key === "Escape" && isFullscreen) {
        document.exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleToggleFullscreen, isFullscreen]);

  if (!camera) {
    return (
      <Card className="flex h-full items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <Video className="mx-auto h-16 w-16 opacity-30" />
          <p className="mt-4 text-lg">Select a camera to view live feed</p>
        </div>
      </Card>
    );
  }

  const personCount = camera.detections.filter((d) => d.class === "person").length;
  const vehicleCount = camera.detections.filter((d) => d.class === "vehicle").length;
  const faceCount = camera.detections.filter((d) => d.class === "face").length;

  return (
    <Card ref={containerRef} className={cn("flex h-full flex-col overflow-hidden", isFullscreen && "rounded-none")}>
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Camera className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{camera.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{camera.location}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {camera.status === "online" && (
            <span className="flex items-center gap-1.5 text-xs text-status-secure">
              <span className="h-2 w-2 animate-pulse rounded-full bg-status-secure" />
              LIVE
            </span>
          )}
          
          {/* Zoom indicator */}
          {zoom > 1 && (
            <span className="text-xs font-mono text-muted-foreground">
              {zoom.toFixed(1)}x
            </span>
          )}

          {/* Zoom controls */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleZoomIn}
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          {/* Reset zoom */}
          {zoom > 1 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={handleResetZoom}
              title="Reset Zoom (0)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}

          {/* Fullscreen toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleToggleFullscreen}
            title="Toggle Fullscreen (F)"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div 
          ref={feedContainerRef}
          className={cn(
            "relative h-full w-full bg-black overflow-hidden",
            zoom > 1 && "cursor-grab active:cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {camera.lastFrame ? (
            <img
              src={camera.lastFrame}
              alt={`${camera.name} live feed`}
              className="h-full w-full object-contain transition-transform duration-100"
              style={{
                transform: `scaleX(-1) scale(${zoom}) translate(${-panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
              }}
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center text-white/60">
                <Camera className="mx-auto h-16 w-16 opacity-30" />
                <p className="mt-4 font-mono text-sm">Waiting for mobile camera...</p>
                <p className="mt-1 text-xs text-white/40">
                  Scan the QR code to connect your phone as a camera
                </p>
              </div>
            </div>
          )}

          {/* Scanline overlay */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="scanline h-full w-full" />
          </div>

          {/* SOS Progress Indicator */}
          {sosProgress > 0 && sosProgress < 3000 && (
            <div className="absolute left-4 right-4 top-4 z-10">
              <div className="rounded-lg bg-destructive/90 p-3 text-destructive-foreground">
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>🆘 SOS GESTURE DETECTED</span>
                  <span>{((sosProgress / 3000) * 100).toFixed(0)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-destructive-foreground/30">
                  <div 
                    className="h-full bg-destructive-foreground transition-all duration-100"
                    style={{ width: `${(sosProgress / 3000) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs opacity-80">
                  Hold arms raised for {Math.max(0, 3 - sosProgress / 1000).toFixed(1)}s more to trigger alert
                </p>
              </div>
            </div>
          )}

          {/* Detection boxes */}
          {camera.detections.map((detection) => (
            <DetectionOverlay key={detection.id} detection={detection} zoom={zoom} panPosition={panPosition} />
          ))}

          {/* Bottom stats bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
            <div className="flex items-center gap-4 text-xs font-mono text-white/80">
              <span className="text-detection-person">Persons: {personCount}</span>
              <span className="text-detection-vehicle">Vehicles: {vehicleCount}</span>
              <span className="text-detection-face">Faces: {faceCount}</span>
            </div>
            <span className="font-mono text-xs text-white/60">
              {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DetectionOverlayProps {
  detection: Detection;
  zoom: number;
  panPosition: { x: number; y: number };
}

function DetectionOverlay({ detection, zoom, panPosition }: DetectionOverlayProps) {
  const { boundingBox, class: detectionClass, confidence, personName, label } = detection;
  
  const colorClass = {
    person: "border-detection-person shadow-[0_0_10px_hsl(var(--detection-person)/0.5)]",
    vehicle: "border-detection-vehicle shadow-[0_0_10px_hsl(var(--detection-vehicle)/0.5)]",
    face: "border-detection-face shadow-[0_0_10px_hsl(var(--detection-face)/0.5)]",
    threat: "border-detection-threat shadow-[0_0_15px_hsl(var(--detection-threat)/0.7)] animate-pulse",
  }[detectionClass];

  const bgClass = {
    person: "bg-detection-person",
    vehicle: "bg-detection-vehicle",
    face: "bg-detection-face",
    threat: "bg-detection-threat",
  }[detectionClass];

  return (
    <div
      className={cn("absolute border-2 transition-all duration-100 pointer-events-none", colorClass)}
      style={{
        left: `${boundingBox.x}%`,
        top: `${boundingBox.y}%`,
        width: `${boundingBox.width}%`,
        height: `${boundingBox.height}%`,
        transform: `scale(${zoom}) translate(${panPosition.x / zoom}px, ${panPosition.y / zoom}px)`,
        transformOrigin: 'top left',
      }}
    >
      {/* Label above box */}
      <div
        className={cn(
          "absolute -top-6 left-0 whitespace-nowrap rounded px-2 py-0.5 text-xs font-bold text-white shadow-lg",
          bgClass
        )}
      >
        {personName || label} {(confidence * 100).toFixed(0)}%
      </div>

      {/* Corner markers */}
      <div className={cn("absolute -left-0.5 -top-0.5 h-2 w-2 border-l-2 border-t-2", colorClass.split(" ")[0])} />
      <div className={cn("absolute -right-0.5 -top-0.5 h-2 w-2 border-r-2 border-t-2", colorClass.split(" ")[0])} />
      <div className={cn("absolute -bottom-0.5 -left-0.5 h-2 w-2 border-b-2 border-l-2", colorClass.split(" ")[0])} />
      <div className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 border-b-2 border-r-2", colorClass.split(" ")[0])} />
    </div>
  );
}
