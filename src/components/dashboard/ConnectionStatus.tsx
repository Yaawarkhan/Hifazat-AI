import { Wifi, WifiOff, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  backendUrl: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function ConnectionStatus({
  isConnected,
  isConnecting,
  error,
  backendUrl,
  onConnect,
  onDisconnect,
}: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          isConnected ? "bg-status-secure/10" : "bg-muted"
        )}
      >
        {isConnecting ? (
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        ) : isConnected ? (
          <Wifi className="h-5 w-5 text-status-secure" />
        ) : (
          <WifiOff className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Server className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">{backendUrl}</span>
        </div>
        <p className={cn("text-sm font-medium", isConnected ? "text-status-secure" : "text-muted-foreground")}>
          {isConnecting
            ? "Connecting to Python backend..."
            : isConnected
            ? "Connected - Receiving video stream"
            : error || "Disconnected from backend"}
        </p>
      </div>

      <Button
        variant={isConnected ? "outline" : "default"}
        size="sm"
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Connecting
          </>
        ) : isConnected ? (
          "Disconnect"
        ) : (
          "Connect"
        )}
      </Button>
    </div>
  );
}
