import { Shield, AlertTriangle, Lock } from "lucide-react";
import type { CampusStatus } from "@/types/detection";
import { cn } from "@/lib/utils";

interface StatusBannerProps {
  status: CampusStatus;
  onReset?: () => void;
}

const statusConfig = {
  secure: {
    icon: Shield,
    label: "Campus Secure",
    description: "All systems operational",
    className: "bg-status-secure text-white",
    glowClass: "glow-secure",
  },
  alert: {
    icon: AlertTriangle,
    label: "Security Alert",
    description: "Incident detected - Monitoring active",
    className: "bg-status-alert text-warning-foreground",
    glowClass: "glow-alert",
  },
  lockdown: {
    icon: Lock,
    label: "CAMPUS LOCKDOWN",
    description: "Threat detected - All gates locked",
    className: "bg-status-lockdown text-white",
    glowClass: "glow-lockdown",
  },
};

export function StatusBanner({ status, onReset }: StatusBannerProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "relative flex items-center justify-between px-6 py-3 transition-all duration-300",
        config.className,
        config.glowClass
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-6 w-6", status === "lockdown" && "animate-pulse")} />
        <div>
          <h2 className="text-lg font-bold tracking-wide">{config.label}</h2>
          <p className="text-sm opacity-90">{config.description}</p>
        </div>
      </div>

      {status !== "secure" && onReset && (
        <button
          onClick={onReset}
          className="rounded-md bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          Reset Status
        </button>
      )}

      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono opacity-70">
        {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
