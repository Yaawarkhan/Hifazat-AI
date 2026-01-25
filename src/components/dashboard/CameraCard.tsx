import { Camera, Users, Car, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
        "cursor-pointer transition-all hover:ring-1 hover:ring-primary/50",
        isSelected && "ring-2 ring-primary",
        camera.status === "online" ? "border-status-secure/30" : "border-muted opacity-60"
      )}
      onClick={onClick}
    >
      <CardContent className="p-2">
        <div className="flex items-center gap-2">
          {/* Thumbnail */}
          <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
            {camera.lastFrame ? (
              <img
                src={camera.lastFrame}
                alt={camera.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Camera className="h-4 w-4 text-muted-foreground/50" />
              </div>
            )}
            {camera.status === "online" && (
              <div className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-status-secure" />
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{camera.name}</p>
            <p className="truncate text-[10px] text-muted-foreground">{camera.location}</p>
            
            {/* Stats */}
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              {personCount > 0 && (
                <span className="flex items-center gap-0.5 text-detection-person">
                  <Users className="h-2.5 w-2.5" />
                  {personCount}
                </span>
              )}
              {vehicleCount > 0 && (
                <span className="flex items-center gap-0.5 text-detection-vehicle">
                  <Car className="h-2.5 w-2.5" />
                  {vehicleCount}
                </span>
              )}
              {faceCount > 0 && (
                <span className="flex items-center gap-0.5 text-detection-face">
                  <User className="h-2.5 w-2.5" />
                  {faceCount}
                </span>
              )}
            </div>
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
    threat: "border-detection-threat animate-pulse",
  }[detectionClass];

  return (
    <div
      className={cn("absolute border transition-all", colorClass)}
      style={{
        left: `${boundingBox.x}%`,
        top: `${boundingBox.y}%`,
        width: `${boundingBox.width}%`,
        height: `${boundingBox.height}%`,
      }}
    >
      <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-black/70 px-1 text-[8px] text-white">
        {personName || label} {(confidence * 100).toFixed(0)}%
      </span>
    </div>
  );
}
