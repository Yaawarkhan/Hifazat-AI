import { Camera, Wifi, WifiOff, Users, Car, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CameraFeed, Detection } from "@/types/detection";
import { cn } from "@/lib/utils";

interface CameraCardProps {
  camera: CameraFeed;
  isSelected?: boolean;
  onClick?: () => void;
}

export function CameraCard({ camera, isSelected, onClick }: CameraCardProps) {
  const personCount = camera.detections.filter((d) => d.class === "person").length;
  const vehicleCount = camera.detections.filter((d) => d.class === "vehicle").length;
  const faceCount = camera.detections.filter((d) => d.class === "face").length;

  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden transition-all duration-200 hover:ring-2 hover:ring-primary/50",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{camera.name}</span>
        </div>
        <Badge
          variant={camera.status === "online" ? "default" : "secondary"}
          className={cn(
            "text-xs",
            camera.status === "online" && "bg-status-secure"
          )}
        >
          {camera.status === "online" ? (
            <Wifi className="mr-1 h-3 w-3" />
          ) : (
            <WifiOff className="mr-1 h-3 w-3" />
          )}
          {camera.status}
        </Badge>
      </CardHeader>

      <CardContent className="p-0">
        {/* Video Feed Placeholder */}
        <div className="relative aspect-video bg-muted">
          {camera.lastFrame ? (
            <img
              src={camera.lastFrame}
              alt={`${camera.name} feed`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Camera className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2 text-xs">Awaiting feed...</p>
              </div>
            </div>
          )}

          {/* Scanline Effect */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="scanline h-full w-full" />
          </div>

          {/* Detection Overlays */}
          {camera.detections.map((detection) => (
            <DetectionBox key={detection.id} detection={detection} />
          ))}
        </div>

        {/* Stats Footer */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
          <span className="text-xs text-muted-foreground">{camera.location}</span>
          <div className="flex items-center gap-3 text-xs">
            {personCount > 0 && (
              <span className="flex items-center gap-1 text-detection-person">
                <Users className="h-3 w-3" />
                {personCount}
              </span>
            )}
            {vehicleCount > 0 && (
              <span className="flex items-center gap-1 text-detection-vehicle">
                <Car className="h-3 w-3" />
                {vehicleCount}
              </span>
            )}
            {faceCount > 0 && (
              <span className="flex items-center gap-1 text-detection-face">
                <User className="h-3 w-3" />
                {faceCount}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetectionBox({ detection }: { detection: Detection }) {
  const { boundingBox, class: detectionClass, confidence, personName, label } = detection;
  
  const colorClass = {
    person: "border-detection-person",
    vehicle: "border-detection-vehicle",
    face: "border-detection-face",
    threat: "border-detection-threat",
  }[detectionClass];

  const bgClass = {
    person: "bg-detection-person",
    vehicle: "bg-detection-vehicle",
    face: "bg-detection-face",
    threat: "bg-detection-threat",
  }[detectionClass];

  return (
    <div
      className={cn("absolute border-2", colorClass)}
      style={{
        left: `${boundingBox.x}%`,
        top: `${boundingBox.y}%`,
        width: `${boundingBox.width}%`,
        height: `${boundingBox.height}%`,
      }}
    >
      <div
        className={cn(
          "absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1 py-0.5 text-[10px] font-mono text-white",
          bgClass
        )}
      >
        {personName || label} {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}
