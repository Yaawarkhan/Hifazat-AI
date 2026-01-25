import { Volume2, VolumeX, AlertTriangle, Mic, MicOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SoundLevelMeterProps {
  level: number; // 0-100
  isListening: boolean;
  lastPrediction?: {
    topClass: string;
    confidence: number;
    isThreat: boolean;
  } | null;
  onToggle: () => void;
}

export function SoundLevelMeter({
  level,
  isListening,
  lastPrediction,
  onToggle,
}: SoundLevelMeterProps) {
  // Determine color based on level and threat
  const getBarColor = () => {
    if (lastPrediction?.isThreat) return "bg-status-lockdown";
    if (level > 80) return "bg-status-alert";
    if (level > 50) return "bg-status-secure";
    return "bg-primary";
  };

  const getBorderColor = () => {
    if (lastPrediction?.isThreat) return "ring-2 ring-status-lockdown animate-pulse";
    return "";
  };

  return (
    <Card className={cn("transition-all duration-300", getBorderColor())}>
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Acoustic Sentinel
          </div>
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onToggle}
          >
            {isListening ? (
              <>
                <MicOff className="h-3 w-3 mr-1" />
                Stop
              </>
            ) : (
              <>
                <Mic className="h-3 w-3 mr-1" />
                Start
              </>
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Sound Level Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Sound Level</span>
            <span className="font-mono">{Math.round(level)}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-100 rounded-full",
                getBarColor()
              )}
              style={{ width: `${level}%` }}
            />
          </div>
          {/* Level indicators */}
          <div className="flex justify-between text-[10px] text-muted-foreground/50 px-0.5">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>

        {/* Last Prediction */}
        {isListening && (
          <div className="rounded-lg bg-muted/30 p-2 text-xs">
            {lastPrediction ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Detected:</span>
                  <span className={cn(
                    "font-medium",
                    lastPrediction.isThreat ? "text-status-lockdown" : "text-foreground"
                  )}>
                    {lastPrediction.topClass}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="font-mono">
                    {(lastPrediction.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {lastPrediction.isThreat && (
                  <div className="flex items-center gap-1 mt-1 text-status-lockdown font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    THREAT DETECTED
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <VolumeX className="h-4 w-4 mx-auto mb-1 opacity-50" />
                <p>Analyzing audio...</p>
              </div>
            )}
          </div>
        )}

        {!isListening && (
          <div className="text-center text-muted-foreground text-xs py-2">
            <MicOff className="h-4 w-4 mx-auto mb-1 opacity-30" />
            <p>Microphone disabled</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
