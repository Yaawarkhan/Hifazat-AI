import { useEffect, useState, useRef, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";

// Weapon classes to detect
const WEAPON_CLASSES = [
  "firearm", "gun", "pistol", "rifle", "handgun",
  "knife", "machete", "blade", "weapon"
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

export function useWeaponDetection({
  confidenceThreshold = 0.70,
  enabled = true,
}: UseWeaponDetectionOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const modelRef = useRef<tf.GraphModel | null>(null);
  const lastProcessedRef = useRef<number>(0);
  const cachedDetectionsRef = useRef<WeaponDetection[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Throttle detection - run every 150ms max
  const DETECTION_INTERVAL_MS = 150;

  // Initialize canvas for processing
  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
  }, []);

  // Load TensorFlow.js and prepare for weapon detection
  useEffect(() => {
    if (!enabled) return;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[WeaponDetection] Loading TensorFlow.js model...");

        // Set backend to WebGL for GPU acceleration
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[WeaponDetection] TensorFlow.js backend:", tf.getBackend());

        // Model is ready for inference
        // In production, load actual weapon detection model:
        // modelRef.current = await tf.loadGraphModel(WEAPON_MODEL_URL);
        
        setIsModelLoaded(true);
        console.log("[WeaponDetection] Model ready (demo mode)");
      } catch (err) {
        console.error("[WeaponDetection] Failed to load model:", err);
        setError("Failed to load weapon detection model");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();

    return () => {
      if (modelRef.current) {
        modelRef.current.dispose?.();
      }
    };
  }, [enabled]);

  // Analyze image for weapon-like objects using edge detection
  const analyzeForWeapons = useCallback((
    imageData: ImageData
  ): WeaponDetection[] => {
    const { data, width, height } = imageData;
    const detections: WeaponDetection[] = [];
    
    // Simple edge detection and shape analysis
    // Look for elongated dark objects (potential knives/guns)
    const gridSize = 32;
    const gridX = Math.floor(width / gridSize);
    const gridY = Math.floor(height / gridSize);
    
    for (let gy = 0; gy < gridY; gy++) {
      for (let gx = 0; gx < gridX; gx++) {
        let darkPixels = 0;
        let edgePixels = 0;
        const totalPixels = gridSize * gridSize;
        
        for (let y = 0; y < gridSize; y++) {
          for (let x = 0; x < gridSize; x++) {
            const px = gx * gridSize + x;
            const py = gy * gridSize + y;
            const idx = (py * width + px) * 4;
            
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const brightness = (r + g + b) / 3;
            
            // Count dark pixels (metallic objects tend to be dark)
            if (brightness < 80) {
              darkPixels++;
            }
            
            // Simple edge detection
            if (px < width - 1 && py < height - 1) {
              const nextIdx = ((py + 1) * width + (px + 1)) * 4;
              const nextBrightness = (data[nextIdx] + data[nextIdx + 1] + data[nextIdx + 2]) / 3;
              if (Math.abs(brightness - nextBrightness) > 50) {
                edgePixels++;
              }
            }
          }
        }
        
        // Heuristic: high dark ratio + high edge ratio = potential weapon
        const darkRatio = darkPixels / totalPixels;
        const edgeRatio = edgePixels / totalPixels;
        
        if (darkRatio > 0.4 && edgeRatio > 0.15) {
          // Potential weapon detected
          const confidence = Math.min(0.95, darkRatio * 0.5 + edgeRatio * 0.8);
          
          if (confidence >= confidenceThreshold) {
            detections.push({
              id: `weapon-${Date.now()}-${gx}-${gy}`,
              class: edgeRatio > 0.25 ? "knife" : "firearm",
              confidence,
              boundingBox: {
                x: (gx * gridSize / width) * 100,
                y: (gy * gridSize / height) * 100,
                width: (gridSize / width) * 100 * 2,
                height: (gridSize / height) * 100 * 2,
              },
            });
          }
        }
      }
    }
    
    // Limit to top 3 detections
    return detections
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }, [confidenceThreshold]);

  // Detect weapons in image/canvas
  const detectWeapons = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<WeaponDetection[]> => {
      if (!isModelLoaded || !enabled) return [];

      const now = Date.now();
      
      // Throttle detection
      if (now - lastProcessedRef.current < DETECTION_INTERVAL_MS) {
        return cachedDetectionsRef.current;
      }
      lastProcessedRef.current = now;

      try {
        const canvas = canvasRef.current;
        if (!canvas) return [];
        
        // Resize input to smaller size for faster processing
        const targetSize = 224;
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return [];
        
        // Draw image to canvas
        ctx.drawImage(input, 0, 0, targetSize, targetSize);
        
        // Get image data for analysis
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        
        // Analyze for weapons
        const detections = analyzeForWeapons(imageData);
        
        cachedDetectionsRef.current = detections;
        return detections;
      } catch (err) {
        console.error("[WeaponDetection] Detection error:", err);
        return cachedDetectionsRef.current;
      }
    },
    [isModelLoaded, enabled, analyzeForWeapons]
  );

  // Check if a detection is a weapon (for external detections)
  const isWeaponClass = useCallback((className: string): boolean => {
    const lowerClass = className.toLowerCase();
    return WEAPON_CLASSES.some(w => lowerClass.includes(w));
  }, []);

  // Simulate a weapon detection for testing
  const simulateWeaponDetection = useCallback((): WeaponDetection => {
    const weapons = ["knife", "firearm", "pistol", "machete"];
    return {
      id: `weapon-${Date.now()}`,
      class: weapons[Math.floor(Math.random() * weapons.length)],
      confidence: 0.75 + Math.random() * 0.2,
      boundingBox: {
        x: 20 + Math.random() * 40,
        y: 20 + Math.random() * 40,
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
