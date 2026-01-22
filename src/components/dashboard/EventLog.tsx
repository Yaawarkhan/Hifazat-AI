import { AlertTriangle, Camera, Clock, CheckCircle, XCircle, Volume2, Hand } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AlertEvent } from "@/types/detection";
import { cn } from "@/lib/utils";

interface EventLogProps {
  events: AlertEvent[];
  onAcknowledge?: (eventId: string) => void;
}

const eventConfig = {
  threat: {
    icon: XCircle,
    color: "text-detection-threat",
    bgColor: "bg-detection-threat/10",
    borderColor: "border-detection-threat/30",
  },
  sos: {
    icon: Hand,
    color: "text-status-alert",
    bgColor: "bg-status-alert/10",
    borderColor: "border-status-alert/30",
  },
  sound: {
    icon: Volume2,
    color: "text-detection-face",
    bgColor: "bg-detection-face/10",
    borderColor: "border-detection-face/30",
  },
  intrusion: {
    icon: AlertTriangle,
    color: "text-status-lockdown",
    bgColor: "bg-status-lockdown/10",
    borderColor: "border-status-lockdown/30",
  },
};

export function EventLog({ events, onAcknowledge }: EventLogProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="border-b py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Recent Events
          </CardTitle>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {events.filter((e) => !e.acknowledged).length} unread
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[400px]">
          {events.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
              <div>
                <CheckCircle className="mx-auto h-8 w-8 opacity-30" />
                <p className="mt-2 text-sm">No events recorded</p>
                <p className="text-xs">System is monitoring</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => {
                const config = eventConfig[event.type];
                const Icon = config.icon;

                return (
                  <div
                    key={event.id}
                    className={cn(
                      "flex gap-3 p-3 transition-colors",
                      !event.acknowledged && config.bgColor,
                      !event.acknowledged && "border-l-2",
                      !event.acknowledged && config.borderColor
                    )}
                  >
                    <div className={cn("mt-0.5", config.color)}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", !event.acknowledged && "font-semibold")}>
                        {event.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Camera className="h-3 w-3" />
                        <span>{event.cameraName}</span>
                        <span>•</span>
                        <span title={formatTime(event.timestamp)}>{formatTimeAgo(event.timestamp)}</span>
                      </div>
                    </div>

                    {!event.acknowledged && onAcknowledge && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => onAcknowledge(event.id)}
                      >
                        Ack
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
