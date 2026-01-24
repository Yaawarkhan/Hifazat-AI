import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreatOverlayProps {
  active: boolean;
}

export function ThreatOverlay({ active }: ThreatOverlayProps) {
  if (!active) return null;

  return (
    <>
      {/* Flashing red border */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 border-8 border-destructive",
          "animate-pulse"
        )}
      />
      
      {/* Alert banner at top */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-3 bg-destructive px-4 py-3 text-destructive-foreground">
        <AlertTriangle className="h-6 w-6 animate-bounce" />
        <span className="text-lg font-bold uppercase tracking-wider">
          ⚠️ THREAT DETECTED - SECURITY ALERT ⚠️
        </span>
        <AlertTriangle className="h-6 w-6 animate-bounce" />
      </div>
    </>
  );
}
