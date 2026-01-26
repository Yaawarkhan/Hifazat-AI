import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmergencyAlert {
  type: "weapon" | "sos" | "sound" | "intrusion";
  message: string;
  cameraName: string;
  location: string;
  confidence?: number;
  snapshot?: string;
  timestamp: string;
  mapsUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const alert: EmergencyAlert = await req.json();
    console.log("[EmergencyDispatch] Received alert:", alert.type, alert.message);

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    const results: { telegram?: boolean; whatsapp?: boolean } = {};

    // Format the alert message
    const alertEmoji = {
      weapon: "🔫",
      sos: "🆘",
      sound: "🔊",
      intrusion: "🚨",
    }[alert.type] || "⚠️";

    const priorityLevel = alert.type === "weapon" ? "🔴 CRITICAL" : 
                          alert.type === "sos" ? "🟠 HIGH" : 
                          "🟡 MEDIUM";

    const formattedMessage = `
${alertEmoji} *HIFAZAT.AI SECURITY ALERT* ${alertEmoji}

*Priority:* ${priorityLevel}
*Type:* ${alert.type.toUpperCase()}
*Message:* ${alert.message}

📍 *Location:* ${alert.location}
📷 *Camera:* ${alert.cameraName}
🕐 *Time:* ${new Date(alert.timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
${alert.confidence ? `📊 *Confidence:* ${(alert.confidence * 100).toFixed(0)}%` : ""}

🗺️ *Navigate to incident:*
${alert.mapsUrl || `https://www.google.com/maps/search/?api=1&query=Aligarh+Muslim+University`}

_Respond immediately. This is an automated alert from Hifazat.ai Campus Security System._
    `.trim();

    // Send Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        console.log("[EmergencyDispatch] Sending Telegram notification...");

        // If we have a snapshot, send as photo
        if (alert.snapshot && alert.snapshot.startsWith("data:image")) {
          // Extract base64 data
          const base64Data = alert.snapshot.split(",")[1];
          if (base64Data) {
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            
            const formData = new FormData();
            formData.append("chat_id", TELEGRAM_CHAT_ID);
            formData.append("caption", formattedMessage);
            formData.append("parse_mode", "Markdown");
            formData.append("photo", new Blob([binaryData], { type: "image/jpeg" }), "alert.jpg");

            const photoResponse = await fetch(
              `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
              {
                method: "POST",
                body: formData,
              }
            );

            const photoResult = await photoResponse.json();
            results.telegram = photoResult.ok;
            console.log("[EmergencyDispatch] Telegram photo result:", photoResult.ok);
          }
        } else {
          // Send text message only
          const textResponse = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: formattedMessage,
                parse_mode: "Markdown",
              }),
            }
          );

          const textResult = await textResponse.json();
          results.telegram = textResult.ok;
          console.log("[EmergencyDispatch] Telegram text result:", textResult.ok);
        }
      } catch (telegramError) {
        console.error("[EmergencyDispatch] Telegram error:", telegramError);
        results.telegram = false;
      }
    } else {
      console.log("[EmergencyDispatch] Telegram not configured (no token/chat ID)");
    }

    // Log the alert for audit purposes
    console.log("[EmergencyDispatch] Alert processed:", {
      type: alert.type,
      location: alert.location,
      timestamp: alert.timestamp,
      results,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Emergency alert dispatched",
        results,
        mapsUrl: alert.mapsUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[EmergencyDispatch] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
