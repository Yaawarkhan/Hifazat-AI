import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface StreamFrame {
  cameraId: string;
  frame: string; // base64 image data
  timestamp: number;
}

interface UseRealtimeStreamOptions {
  channelName?: string;
  onFrame?: (frame: StreamFrame) => void;
}

export function useRealtimeStream({
  channelName = "camera-stream",
  onFrame,
}: UseRealtimeStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Connect to realtime channel
  useEffect(() => {
    console.log("[Realtime] Connecting to channel:", channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        const frame = payload as StreamFrame;
        onFrame?.(frame);
      })
      .subscribe((status) => {
        console.log("[Realtime] Channel status:", status);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setError(null);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setError("Connection lost");
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[Realtime] Disconnecting from channel");
      channel.unsubscribe();
    };
  }, [channelName, onFrame]);

  // Send a frame to the channel
  const sendFrame = useCallback(
    async (cameraId: string, frameData: string) => {
      if (!channelRef.current) return;

      try {
        await channelRef.current.send({
          type: "broadcast",
          event: "frame",
          payload: {
            cameraId,
            frame: frameData,
            timestamp: Date.now(),
          } as StreamFrame,
        });
      } catch (err) {
        console.error("[Realtime] Failed to send frame:", err);
      }
    },
    []
  );

  return {
    isConnected,
    error,
    sendFrame,
  };
}
