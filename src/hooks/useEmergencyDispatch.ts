import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EmergencyAlertData {
  type: "weapon" | "sos" | "sound" | "intrusion";
  message: string;
  cameraName: string;
  location: string;
  confidence?: number;
  snapshot?: string;
}

export function useEmergencyDispatch() {
  const [isSending, setIsSending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  // Debounce - don't send more than once every 30 seconds
  const DEBOUNCE_MS = 30000;

  const sendEmergencyAlert = useCallback(async (data: EmergencyAlertData) => {
    const now = Date.now();
    
    // Check debounce
    if (lastSentAt && now - lastSentAt < DEBOUNCE_MS) {
      console.log("[Dispatch] Skipping - too soon since last alert");
      return { success: false, reason: "debounced" };
    }

    setIsSending(true);
    setLastSentAt(now);

    try {
      console.log("[Dispatch] Sending emergency alert:", data.type);

      const { data: response, error } = await supabase.functions.invoke("emergency-dispatch", {
        body: {
          type: data.type,
          message: data.message,
          cameraName: data.cameraName,
          location: data.location,
          confidence: data.confidence,
          snapshot: data.snapshot?.substring(0, 50000), // Limit snapshot size
          timestamp: new Date().toISOString(),
          // Google Maps navigation link
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=Aligarh+Muslim+University+${encodeURIComponent(data.location)}`,
        },
      });

      if (error) {
        console.error("[Dispatch] Error:", error);
        return { success: false, error };
      }

      console.log("[Dispatch] Alert sent successfully:", response);
      return { success: true, response };
    } catch (err) {
      console.error("[Dispatch] Failed:", err);
      return { success: false, error: err };
    } finally {
      setIsSending(false);
    }
  }, [lastSentAt]);

  // Check if dispatch is configured (has Telegram bot token)
  const isDispatchConfigured = true; // Will be true once edge function is deployed

  return {
    sendEmergencyAlert,
    isSending,
    isDispatchConfigured,
  };
}
