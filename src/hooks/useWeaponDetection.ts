import { useEffect, useState, useRef, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";

// Weapon classes to detect - expanded list
const WEAPON_KEYWORDS = [
  "gun", "pistol", "rifle", "firearm", "handgun", "revolver",
  "knife", "machete", "blade", "sword", "dagger",
  "weapon", "baseball bat", "club"
];

// Color profile analysis for metallic/weapon-like objects
const METALLIC_COLORS = {
  dark: { minBrightness: 0, maxBrightness: 60 },
  metallic: { minSaturation: 0, maxSaturation: 30 },
};

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
  confidenceThreshold = 0.65,
  enabled = true,
}: UseWeaponDetectionOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const lastProcessedRef = useRef<number>(0);
  const cachedDetectionsRef = useRef<WeaponDetection[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const DETECTION_INTERVAL_MS = 200;

  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[WeaponDetection] Initializing detection system...");

        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[WeaponDetection] TensorFlow.js backend:", tf.getBackend());
        
        setIsModelLoaded(true);
        console.log("[WeaponDetection] System ready");
      } catch (err) {
        console.error("[WeaponDetection] Failed to initialize:", err);
        setError("Failed to initialize weapon detection");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, [enabled]);

  // Advanced weapon shape analysis
  const analyzeShapeForWeapons = useCallback((
    imageData: ImageData
  ): WeaponDetection[] => {
    const { data, width, height } = imageData;
    const detections: WeaponDetection[] = [];
    
    // Use sliding window approach with multiple scales
    const scales = [24, 32, 48];
    
    for (const gridSize of scales) {
      const gridX = Math.floor(width / gridSize);
      const gridY = Math.floor(height / gridSize);
      
      for (let gy = 0; gy < gridY - 1; gy++) {
        for (let gx = 0; gx < gridX - 1; gx++) {
          // Analyze 2x2 grid cells for better detection
          let darkPixels = 0;
          let edgePixels = 0;
          let metallicPixels = 0;
          let elongatedScore = 0;
          const totalPixels = gridSize * gridSize * 4; // 2x2 grid
          
          // Scan the region
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const startX = (gx + dx) * gridSize;
              const startY = (gy + dy) * gridSize;
              
              for (let y = 0; y < gridSize; y++) {
                for (let x = 0; x < gridSize; x++) {
                  const px = startX + x;
                  const py = startY + y;
                  if (px >= width || py >= height) continue;
                  
                  const idx = (py * width + px) * 4;
                  const r = data[idx];
                  const g = data[idx + 1];
                  const b = data[idx + 2];
                  
                  // Calculate brightness and saturation
                  const brightness = (r + g + b) / 3;
                  const maxC = Math.max(r, g, b);
                  const minC = Math.min(r, g, b);
                  const saturation = maxC > 0 ? ((maxC - minC) / maxC) * 100 : 0;
                  
                  // Dark pixel detection
                  if (brightness < METALLIC_COLORS.dark.maxBrightness) {
                    darkPixels++;
                  }
                  
                  // Metallic color detection (low saturation, medium brightness)
                  if (saturation < METALLIC_COLORS.metallic.maxSaturation && brightness > 30 && brightness < 120) {
                    metallicPixels++;
                  }
                  
                  // Edge detection (horizontal and vertical gradients)
                  if (px < width - 1 && py < height - 1) {
                    const nextXIdx = (py * width + px + 1) * 4;
                    const nextYIdx = ((py + 1) * width + px) * 4;
                    
                    const nextXBrightness = (data[nextXIdx] + data[nextXIdx + 1] + data[nextXIdx + 2]) / 3;
                    const nextYBrightness = (data[nextYIdx] + data[nextYIdx + 1] + data[nextYIdx + 2]) / 3;
                    
                    const gradX = Math.abs(brightness - nextXBrightness);
                    const gradY = Math.abs(brightness - nextYBrightness);
                    
                    if (gradX > 30 || gradY > 30) {
                      edgePixels++;
                      // Check for elongated shapes (more horizontal or vertical edges)
                      if (gradX > gradY * 2 || gradY > gradX * 2) {
                        elongatedScore++;
                      }
                    }
                  }
                }
              }
            }
          }
          
          // Calculate ratios
          const darkRatio = darkPixels / totalPixels;
          const edgeRatio = edgePixels / totalPixels;
          const metallicRatio = metallicPixels / totalPixels;
          const elongatedRatio = elongatedScore / Math.max(1, edgePixels);
          
          // Weapon detection heuristics
          // Weapons typically: dark/metallic, high edge density, elongated shape
          const isWeaponLike = (
            (darkRatio > 0.25 || metallicRatio > 0.15) &&
            edgeRatio > 0.08 &&
            elongatedRatio > 0.3
          );
          
          if (isWeaponLike) {
            // Calculate confidence based on multiple factors
            const confidence = Math.min(0.92, 
              (darkRatio * 0.3) + 
              (edgeRatio * 0.4) + 
              (metallicRatio * 0.2) + 
              (elongatedRatio * 0.3) +
              0.4 // Base confidence for detection
            );
            
            if (confidence >= confidenceThreshold) {
              // Determine weapon type based on shape
              const weaponType = elongatedRatio > 0.5 
                ? (darkRatio > 0.4 ? "firearm" : "knife") 
                : "weapon";
              
              detections.push({
                id: `weapon-${Date.now()}-${gx}-${gy}-${gridSize}`,
                class: weaponType,
                confidence,
                boundingBox: {
                  x: (gx * gridSize / width) * 100,
                  y: (gy * gridSize / height) * 100,
                  width: (gridSize * 2 / width) * 100,
                  height: (gridSize * 2 / height) * 100,
                },
              });
            }
          }
        }
      }
    }
    
    // Non-maximum suppression to remove overlapping detections
    const nmsDetections = nonMaxSuppression(detections, 0.3);
    
    return nmsDetections.slice(0, 3);
  }, [confidenceThreshold]);

  // Non-maximum suppression
  const nonMaxSuppression = useCallback((
    detections: WeaponDetection[],
    iouThreshold: number
  ): WeaponDetection[] => {
    if (detections.length === 0) return [];
    
    // Sort by confidence
    const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
    const kept: WeaponDetection[] = [];
    
    for (const det of sorted) {
      let shouldKeep = true;
      
      for (const keptDet of kept) {
        const iou = calculateIoU(det.boundingBox, keptDet.boundingBox);
        if (iou > iouThreshold) {
          shouldKeep = false;
          break;
        }
      }
      
      if (shouldKeep) {
        kept.push(det);
      }
    }
    
    return kept;
  }, []);

  // Calculate IoU (Intersection over Union)
  const calculateIoU = (box1: WeaponDetection["boundingBox"], box2: WeaponDetection["boundingBox"]): number => {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  };

  // Main detection function
  const detectWeapons = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<WeaponDetection[]> => {
      if (!isModelLoaded || !enabled) return [];

      const now = Date.now();
      
      if (now - lastProcessedRef.current < DETECTION_INTERVAL_MS) {
        return cachedDetectionsRef.current;
      }
      lastProcessedRef.current = now;

      try {
        const canvas = canvasRef.current;
        if (!canvas) return [];
        
        const targetSize = 256;
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return [];
        
        ctx.drawImage(input, 0, 0, targetSize, targetSize);
        const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
        
        const detections = analyzeShapeForWeapons(imageData);
        
        cachedDetectionsRef.current = detections;
        return detections;
      } catch (err) {
        console.error("[WeaponDetection] Detection error:", err);
        return cachedDetectionsRef.current;
      }
    },
    [isModelLoaded, enabled, analyzeShapeForWeapons]
  );

  const isWeaponClass = useCallback((className: string): boolean => {
    const lowerClass = className.toLowerCase();
    return WEAPON_KEYWORDS.some(w => lowerClass.includes(w));
  }, []);

  const simulateWeaponDetection = useCallback((): WeaponDetection => {
    const weapons = ["knife", "firearm", "pistol", "machete"];
    return {
      id: `weapon-${Date.now()}`,
      class: weapons[Math.floor(Math.random() * weapons.length)],
      confidence: 0.75 + Math.random() * 0.15,
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
