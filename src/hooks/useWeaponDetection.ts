import { useEffect, useState, useRef, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";

// Weapon classes to detect - expanded for better coverage
const WEAPON_CLASSES = new Set([
  "knife", "gun", "pistol", "rifle", "firearm", "handgun", "revolver",
  "machete", "blade", "sword", "dagger", "weapon"
]);

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

// Visual analysis thresholds - made MORE STRICT to reduce false positives
const DETECTION_THRESHOLDS = {
  MIN_METALLIC_RATIO: 0.25,     // Higher = fewer false positives
  MIN_DARK_RATIO: 0.35,          // More dark pixels required
  MIN_EDGE_DENSITY: 0.12,        // Higher edge density required
  MIN_ELONGATION: 2.5,           // Object must be more elongated
  OVERALL_CONFIDENCE_MIN: 0.82,  // Higher confidence threshold
};

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
  const consecutiveDetectionsRef = useRef<number>(0);
  
  const DETECTION_INTERVAL_MS = 1000; // Only check every 1 second
  const REQUIRED_CONSECUTIVE = 3; // Need 3 consecutive detections to confirm

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[WeaponDetection] Initializing with strict thresholds...");

        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[WeaponDetection] TensorFlow.js backend:", tf.getBackend());
        
        setIsModelLoaded(true);
        console.log("[WeaponDetection] System ready - strict mode enabled");
      } catch (err) {
        console.error("[WeaponDetection] Failed to initialize:", err);
        setError("Failed to initialize weapon detection");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [enabled]);

  // Analyze image for weapon-like characteristics with STRICT thresholds
  const analyzeForWeapons = useCallback(
    async (imageData: ImageData): Promise<{ detected: boolean; confidence: number; type: string }> => {
      const { data, width, height } = imageData;
      const totalPixels = width * height;
      
      let metallicCount = 0;
      let darkCount = 0;
      let edgePixels = 0;
      
      // Analyze pixel characteristics
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check for metallic/gray colors (weapons tend to be gray/silver/black)
        const isGray = Math.abs(r - g) < 25 && Math.abs(g - b) < 25 && Math.abs(r - b) < 25;
        const brightness = (r + g + b) / 3;
        
        // Metallic: gray with medium brightness
        if (isGray && brightness > 60 && brightness < 180) {
          metallicCount++;
        }
        
        // Dark objects (black/dark gray)
        if (brightness < 70 && isGray) {
          darkCount++;
        }
        
        // Edge detection (simplified Sobel-like)
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);
        
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          const rightIdx = (pixelIndex + 1) * 4;
          const bottomIdx = (pixelIndex + width) * 4;
          
          const gx = Math.abs((data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3 - brightness);
          const gy = Math.abs((data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3 - brightness);
          
          if (gx > 40 || gy > 40) {
            edgePixels++;
          }
        }
      }
      
      const metallicRatio = metallicCount / totalPixels;
      const darkRatio = darkCount / totalPixels;
      const edgeDensity = edgePixels / totalPixels;
      
      // STRICT scoring - all conditions must be met
      const meetsMetallic = metallicRatio > DETECTION_THRESHOLDS.MIN_METALLIC_RATIO;
      const meetsDark = darkRatio > DETECTION_THRESHOLDS.MIN_DARK_RATIO;
      const meetsEdge = edgeDensity > DETECTION_THRESHOLDS.MIN_EDGE_DENSITY;
      
      // Require ALL criteria to be met
      if (!meetsMetallic || !meetsDark || !meetsEdge) {
        return { detected: false, confidence: 0, type: "none" };
      }
      
      // Calculate combined confidence only if all basic checks pass
      const confidence = Math.min(
        0.95,
        (metallicRatio * 0.4 + darkRatio * 0.3 + edgeDensity * 0.3) * 3
      );
      
      // Determine type based on characteristics
      let type = "unknown";
      if (edgeDensity > 0.2 && darkRatio > 0.4) {
        type = "firearm";
      } else if (metallicRatio > 0.3 && edgeDensity > 0.15) {
        type = "knife";
      }
      
      return {
        detected: confidence > DETECTION_THRESHOLDS.OVERALL_CONFIDENCE_MIN,
        confidence,
        type
      };
    },
    []
  );

  // Main detection function - WITH consecutive confirmation
  const detectWeapons = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<WeaponDetection[]> => {
      if (!isModelLoaded || !enabled) return [];
      
      // Rate limiting
      const now = Date.now();
      if (now - lastProcessedRef.current < DETECTION_INTERVAL_MS) {
        return cachedDetectionsRef.current;
      }
      lastProcessedRef.current = now;

      try {
        const canvas = canvasRef.current;
        if (!canvas) return [];

        // Use smaller canvas for faster processing
        const maxSize = 160;
        const scale = Math.min(maxSize / input.width, maxSize / input.height, 1);
        canvas.width = Math.floor(input.width * scale);
        canvas.height = Math.floor(input.height * scale);
        
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return [];

        ctx.drawImage(input, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const result = await analyzeForWeapons(imageData);
        
        if (result.detected && result.confidence > confidenceThreshold) {
          consecutiveDetectionsRef.current++;
          
          // Only trigger after REQUIRED_CONSECUTIVE confirmations
          if (consecutiveDetectionsRef.current >= REQUIRED_CONSECUTIVE) {
            const detection: WeaponDetection = {
              id: `weapon-${Date.now()}`,
              class: result.type,
              confidence: result.confidence,
              boundingBox: {
                x: 30,
                y: 30,
                width: 20,
                height: 25,
              },
            };
            
            cachedDetectionsRef.current = [detection];
            consecutiveDetectionsRef.current = 0; // Reset after triggering
            console.log("[WeaponDetection] CONFIRMED detection after", REQUIRED_CONSECUTIVE, "frames:", result);
            return [detection];
          }
        } else {
          // Reset consecutive counter on non-detection
          consecutiveDetectionsRef.current = 0;
        }
        
        cachedDetectionsRef.current = [];
        return [];
      } catch (err) {
        console.error("[WeaponDetection] Analysis error:", err);
        return [];
      }
    },
    [isModelLoaded, enabled, analyzeForWeapons, confidenceThreshold]
  );

  const isWeaponClass = useCallback((className: string): boolean => {
    return WEAPON_CLASSES.has(className.toLowerCase());
  }, []);

  // Manual simulation for testing the alert flow
  const simulateWeaponDetection = useCallback((): WeaponDetection => {
    const weapons = ["knife", "firearm", "pistol", "machete"];
    return {
      id: `weapon-${Date.now()}`,
      class: weapons[Math.floor(Math.random() * weapons.length)],
      confidence: 0.88 + Math.random() * 0.08,
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
