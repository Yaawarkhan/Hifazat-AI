import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface StreamFrame {
  cameraId: string;
  frame: string; // base64 image data
  timestamp: number;
}

interface AudioData {
  cameraId: string;
  level: number; // 0-100
  isThreat: boolean;
  threatClass?: string;
  confidence?: number;
  timestamp: number;
}

interface UseRealtimeStreamOptions {
  channelName?: string;
  onFrame?: (frame: StreamFrame) => void;
  onAudio?: (audio: AudioData) => void;
}

export function useRealtimeStream({
  channelName = "camera-stream",
  onFrame,
  onAudio,
}: UseRealtimeStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onFrameRef = useRef(onFrame);
  const onAudioRef = useRef(onAudio);
  
  // Keep refs updated without triggering reconnection
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    onAudioRef.current = onAudio;
  }, [onAudio]);

  // Connect to realtime channel - optimized for zero latency
  useEffect(() => {
    console.log("[Realtime] Connecting to channel:", channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { 
          self: false,
          ack: false, // CRITICAL: Disable acks for zero latency
        },
        presence: {
          key: "dashboard",
        },
      },
    });

    channel
      .on("broadcast", { event: "frame" }, ({ payload }) => {
        const frame = payload as StreamFrame;
        onFrameRef.current?.(frame);
      })
      .on("broadcast", { event: "audio" }, ({ payload }) => {
        const audio = payload as AudioData;
        onAudioRef.current?.(audio);
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
  }, [channelName]);

  // Send a frame to the channel - optimized for speed
  const sendFrame = useCallback(
    (cameraId: string, frameData: string) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: "broadcast",
        event: "frame",
        payload: {
          cameraId,
          frame: frameData,
          timestamp: Date.now(),
        } as StreamFrame,
      }).catch((err) => {
        if (err?.message !== "rate limited") {
          console.error("[Realtime] Failed to send frame:", err);
        }
      });
    },
    []
  );

  // Send audio data to the channel
  const sendAudio = useCallback(
    (data: Omit<AudioData, "timestamp">) => {
      if (!channelRef.current) return;

      channelRef.current.send({
        type: "broadcast",
        event: "audio",
        payload: {
          ...data,
          timestamp: Date.now(),
        } as AudioData,
      }).catch((err) => {
        if (err?.message !== "rate limited") {
          console.error("[Realtime] Failed to send audio:", err);
        }
      });
    },
    []
  );

  return {
    isConnected,
    error,
    sendFrame,
    sendAudio,
  };
}
