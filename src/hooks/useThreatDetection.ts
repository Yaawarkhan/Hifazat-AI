import { useCallback, useRef } from "react";
import type { Detection, AlertEvent } from "@/types/detection";
import { supabase } from "@/integrations/supabase/client";

// Weapon class detection (for future YOLO integration)
// For now, this provides the structure for Phase 2.1 weapon detection
const WEAPON_CLASSES = ["firearm", "gun", "pistol", "knife", "machete", "weapon"];
const WEAPON_CONFIDENCE_THRESHOLD = 0.70;

interface ThreatState {
  lastWeaponAlert: number | null;
  lastSOSAlert: number | null;
}

interface ThreatDetectionResult {
  isWeaponDetected: boolean;
  isSOSTriggered: boolean;
  threatType: "weapon" | "sos" | null;
}

// Debounce alerts - don't spam (minimum 5 seconds between same type)
const ALERT_DEBOUNCE_MS = 5000;

export function useThreatDetection() {
  const threatStateRef = useRef<ThreatState>({
    lastWeaponAlert: null,
    lastSOSAlert: null,
  });

  // Check if any detection is a weapon
  const checkForWeapons = useCallback((detections: Detection[]): Detection | null => {
    for (const detection of detections) {
      const label = detection.label.toLowerCase();
      const isWeapon = WEAPON_CLASSES.some((weaponClass) => 
        label.includes(weaponClass)
      );
      
      if (isWeapon && detection.confidence >= WEAPON_CONFIDENCE_THRESHOLD) {
        return detection;
      }
    }
    return null;
  }, []);

  // Save snapshot to Supabase Storage (or locally as base64)
  const saveSnapshot = useCallback(async (
    frameData: string,
    alertType: "weapon" | "sos",
    cameraId: string
  ): Promise<string | null> => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${alertType}_${cameraId}_${timestamp}.jpg`;
      
      // Convert base64 to blob
      const base64Data = frameData.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      console.log(`[ThreatDetection] Saving snapshot: ${filename}`);
      
      // For now, return the base64 data directly
      // In production, upload to Supabase Storage
      return frameData;
    } catch (err) {
      console.error("[ThreatDetection] Failed to save snapshot:", err);
      return null;
    }
  }, []);

  // Create an alert event
  const createAlert = useCallback(async (
    type: "weapon" | "sos",
    cameraId: string,
    cameraName: string,
    frameData?: string
  ): Promise<AlertEvent | null> => {
    const now = Date.now();
    
    // Check debounce
    if (type === "weapon" && threatStateRef.current.lastWeaponAlert) {
      if (now - threatStateRef.current.lastWeaponAlert < ALERT_DEBOUNCE_MS) {
        return null;
      }
    }
    if (type === "sos" && threatStateRef.current.lastSOSAlert) {
      if (now - threatStateRef.current.lastSOSAlert < ALERT_DEBOUNCE_MS) {
        return null;
      }
    }

    // Update last alert time
    if (type === "weapon") {
      threatStateRef.current.lastWeaponAlert = now;
    } else {
      threatStateRef.current.lastSOSAlert = now;
    }

    // Save snapshot if frame data is provided
    let snapshot: string | undefined;
    if (frameData) {
      const saved = await saveSnapshot(frameData, type, cameraId);
      if (saved) snapshot = saved;
    }

    const alert: AlertEvent = {
      id: `alert-${now}`,
      type: type === "weapon" ? "threat" : "sos",
      message: type === "weapon" 
        ? "⚠️ WEAPON DETECTED - Immediate response required!"
        : "🆘 SOS GESTURE DETECTED - Person signaling for help!",
      cameraId,
      cameraName,
      timestamp: now,
      snapshot,
      acknowledged: false,
    };

    console.log(`[ThreatDetection] Alert created:`, alert.message);
    return alert;
  }, [saveSnapshot]);

  // Process frame for threats (wrapper function)
  const processThreats = useCallback((
    detections: Detection[],
    sosTriggered: boolean
  ): ThreatDetectionResult => {
    const weaponDetection = checkForWeapons(detections);
    
    return {
      isWeaponDetected: weaponDetection !== null,
      isSOSTriggered: sosTriggered,
      threatType: weaponDetection ? "weapon" : sosTriggered ? "sos" : null,
    };
  }, [checkForWeapons]);

  return {
    checkForWeapons,
    saveSnapshot,
    createAlert,
    processThreats,
  };
}
