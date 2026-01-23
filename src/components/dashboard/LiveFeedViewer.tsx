import { Camera, Maximize2, ZoomIn, ZoomOut, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CameraFeed, Detection } from "@/types/detection";
import { cn } from "@/lib/utils";

interface LiveFeedViewerProps {
  camera: CameraFeed | null;
}

export function LiveFeedViewer({ camera }: LiveFeedViewerProps) {
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
    <Card className="flex h-full flex-col overflow-hidden">
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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <div className="relative h-full w-full bg-black">
          {camera.lastFrame ? (
            <img
              src={camera.lastFrame}
              alt={`${camera.name} live feed`}
              className="h-full w-full object-contain"
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

          {/* Detection boxes */}
          {camera.detections.map((detection) => (
            <DetectionOverlay key={detection.id} detection={detection} />
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

function DetectionOverlay({ detection }: { detection: Detection }) {
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
      className={cn("absolute border-2 transition-all duration-100", colorClass)}
      style={{
        left: `${boundingBox.x}%`,
        top: `${boundingBox.y}%`,
        width: `${boundingBox.width}%`,
        height: `${boundingBox.height}%`,
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
