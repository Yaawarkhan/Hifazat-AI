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
  maxDetections?: number;
}

// Using COCO-SSD for object detection as a base
// In production, you would load a custom-trained weapon detection model
const COCO_SSD_MODEL_URL = "https://tfhub.dev/tensorflow/tfjs-model/ssd_mobilenet_v2/1/default/1";

// COCO class names that could indicate weapons or dangerous items
const DANGEROUS_COCO_CLASSES: Record<number, string> = {
  43: "knife", // COCO knife class
  // Additional mappings can be added for custom models
};

export function useWeaponDetection({
  confidenceThreshold = 0.70,
  maxDetections = 5,
}: UseWeaponDetectionOptions = {}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const modelRef = useRef<any>(null);
  const lastProcessedRef = useRef<number>(0);
  const cachedDetectionsRef = useRef<WeaponDetection[]>([]);
  
  // Throttle detection to 10 FPS max
  const DETECTION_INTERVAL_MS = 100;

  // Load TensorFlow.js model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[WeaponDetection] Loading TensorFlow.js model...");

        // Set backend to WebGL for GPU acceleration
        await tf.setBackend("webgl");
        await tf.ready();
        console.log("[WeaponDetection] TensorFlow.js backend:", tf.getBackend());

        // For demo purposes, we'll use a simulated detection approach
        // In production, you would load a real weapon detection model:
        // const model = await tf.loadGraphModel(WEAPON_MODEL_URL);
        
        // Mark as loaded for demo
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
      // Cleanup
      if (modelRef.current) {
        modelRef.current.dispose?.();
      }
    };
  }, []);

  // Detect weapons in image/canvas
  const detectWeapons = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<WeaponDetection[]> => {
      if (!isModelLoaded) return cachedDetectionsRef.current;

      const now = Date.now();
      
      // Throttle detection
      if (now - lastProcessedRef.current < DETECTION_INTERVAL_MS) {
        return cachedDetectionsRef.current;
      }
      lastProcessedRef.current = now;

      try {
        // For demo purposes, we simulate weapon detection
        // In production, you would run actual inference:
        // const predictions = await modelRef.current.executeAsync(inputTensor);
        
        // Demo: Return empty array (no weapons detected in normal operation)
        // The system is ready to process real detections when a model is integrated
        const detections: WeaponDetection[] = [];
        
        cachedDetectionsRef.current = detections;
        return detections;
      } catch (err) {
        console.error("[WeaponDetection] Detection error:", err);
        return cachedDetectionsRef.current;
      }
    },
    [isModelLoaded]
  );

  // Check if a detection is a weapon (for external detections)
  const isWeaponClass = useCallback((className: string): boolean => {
    const lowerClass = className.toLowerCase();
    return WEAPON_CLASSES.some(w => lowerClass.includes(w));
  }, []);

  // Simulate a weapon detection for testing
  const simulateWeaponDetection = useCallback((): WeaponDetection => {
    return {
      id: `weapon-${Date.now()}`,
      class: "knife",
      confidence: 0.85,
      boundingBox: {
        x: 30 + Math.random() * 20,
        y: 30 + Math.random() * 20,
        width: 15,
        height: 20,
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
