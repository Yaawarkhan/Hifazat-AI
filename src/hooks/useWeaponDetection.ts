import { useEffect, useState, useRef, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";

// Weapon classes to detect
const WEAPON_KEYWORDS = [
  "gun", "pistol", "rifle", "firearm", "handgun", "revolver",
  "knife", "machete", "blade", "sword", "dagger"
];

interface WeaponDetection {
  id: string;
  class: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface UseWeaponDetectionOptions {
  confidenceThreshold?: number;
  enabled?: boolean;
}

// NOTE: Automatic weapon detection via heuristics is DISABLED
// The heuristic-based approach was generating too many false positives.
// Weapon detection now ONLY works via manual "Test" button triggers.
// For production, integrate a proper trained YOLO/COCO model for weapon detection.

export function useWeaponDetection({
  confidenceThreshold = 0.85,
  enabled = true,
}: UseWeaponDetectionOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const lastProcessedRef = useRef<number>(0);
  const cachedDetectionsRef = useRef<WeaponDetection[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const DETECTION_INTERVAL_MS = 500;

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[WeaponDetection] Initializing (manual trigger only)...");

        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[WeaponDetection] TensorFlow.js backend:", tf.getBackend());
        
        setIsModelLoaded(true);
        console.log("[WeaponDetection] System ready - manual trigger mode");
      } catch (err) {
        console.error("[WeaponDetection] Failed to initialize:", err);
        setError("Failed to initialize weapon detection");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [enabled]);

  // Weapon detection is DISABLED for automatic scanning
  // The heuristic approach generated too many false positives
  // This now returns empty array - detection only via manual test button

  // Main detection function - DISABLED automatic detection
  // Returns empty array to prevent false positives
  // Use simulateWeaponDetection() for manual testing
  const detectWeapons = useCallback(
    async (
      _input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<WeaponDetection[]> => {
      // Automatic detection disabled - too many false positives
      // For production, integrate a proper YOLO/COCO trained model
      return [];
    },
    [isModelLoaded, enabled]
  );

  const isWeaponClass = useCallback((className: string): boolean => {
    const lowerClass = className.toLowerCase();
    return WEAPON_KEYWORDS.some(w => lowerClass.includes(w));
  }, []);

  // Manual simulation for testing the alert flow
  const simulateWeaponDetection = useCallback((): WeaponDetection => {
    const weapons = ["knife", "firearm", "pistol", "machete"];
    return {
      id: `weapon-${Date.now()}`,
      class: weapons[Math.floor(Math.random() * weapons.length)],
      confidence: 0.85 + Math.random() * 0.10,
      boundingBox: {
        x: 25 + Math.random() * 30,
        y: 25 + Math.random() * 30,
        width: 15 + Math.random() * 10,
        height: 20 + Math.random() * 10,
      },
    };
  }, []);

  return {
    isModelLoaded,
    isLoading,
    error,
    detectWeapons,
    isWeaponClass,
    simulateWeaponDetection,
    confidenceThreshold,
  };
}
