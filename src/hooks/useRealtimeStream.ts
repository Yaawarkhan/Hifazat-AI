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
  const onFrameRef = useRef(onFrame);
  
  // Keep onFrame ref updated without triggering reconnection
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Connect to realtime channel - only reconnect when channelName changes
  useEffect(() => {
    console.log("[Realtime] Connecting to channel:", channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { 
          self: false,
          ack: false, // Disable acknowledgments for lower latency
        },
      },
    });

    channel
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        const frame = payload as StreamFrame;
        // Use ref to avoid stale closure
        onFrameRef.current?.(frame);
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
  }, [channelName]); // Only depend on channelName, not onFrame

  // Send a frame to the channel - optimized for speed
  const sendFrame = useCallback(
    (cameraId: string, frameData: string) => {
      if (!channelRef.current) return;

      // Fire and forget - don't await for maximum speed
      channelRef.current.send({
        type: "broadcast",
        event: "frame",
        payload: {
          cameraId,
          frame: frameData,
          timestamp: Date.now(),
        } as StreamFrame,
      }).catch((err) => {
        // Only log if it's a real error, not just network hiccup
        if (err?.message !== "rate limited") {
          console.error("[Realtime] Failed to send frame:", err);
        }
      });
    },
    []
  );

  return {
    isConnected,
    error,
    sendFrame,
  };
}
