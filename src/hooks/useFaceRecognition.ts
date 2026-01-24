import { useEffect, useState, useRef, useCallback } from "react";
import * as faceapi from "@vladmandic/face-api";

interface KnownFace {
  name: string;
  descriptor: Float32Array;
}

interface FaceDetection {
  id: string;
  name: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const KNOWN_FACES = [
  { name: "Mohammad Yaawar Khan", imagePath: "/known-faces/Mohammad_Yaawar_Khan.jpeg" },
  { name: "Bakhtiyar Khan", imagePath: "/known-faces/Bakhtiyar_Khan.jpeg" },
  { name: "Faiz Ahmad Khan", imagePath: "/known-faces/Faiz_Ahmad_Khan.jpeg" },
];

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";

// Performance settings
const FACE_DETECTION_INTERVAL_MS = 200; // Process faces every 200ms (5 FPS)
const MIN_CONFIDENCE = 0.5;

export function useFaceRecognition() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownFacesRef = useRef<KnownFace[]>([]);
  const lastProcessedRef = useRef<number>(0);
  const cachedDetectionsRef = useRef<FaceDetection[]>([]);

  // Load face-api models (using TinyFaceDetector for better performance)
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[FaceAPI] Loading models from CDN...");

        // Use TinyFaceDetector instead of SSD for faster performance
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        console.log("[FaceAPI] Models loaded successfully");

        // Load known faces
        console.log("[FaceAPI] Loading known faces...");
        for (const face of KNOWN_FACES) {
          try {
            const img = await faceapi.fetchImage(face.imagePath);
            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
              .withFaceLandmarks(true)
              .withFaceDescriptor();

            if (detection) {
              knownFacesRef.current.push({
                name: face.name,
                descriptor: detection.descriptor,
              });
              console.log(`[FaceAPI] Loaded face: ${face.name}`);
            } else {
              console.warn(`[FaceAPI] No face detected in: ${face.name}`);
            }
          } catch (err) {
            console.error(`[FaceAPI] Failed to load ${face.name}:`, err);
          }
        }

        console.log(`[FaceAPI] Loaded ${knownFacesRef.current.length} known faces`);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("[FaceAPI] Failed to load models:", err);
        setError("Failed to load face recognition models");
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  // Detect faces in an image/video element with throttling
  const detectFaces = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<FaceDetection[]> => {
      if (!isModelLoaded) return cachedDetectionsRef.current;

      const now = Date.now();
      
      // Throttle face detection to 5 FPS for performance
      if (now - lastProcessedRef.current < FACE_DETECTION_INTERVAL_MS) {
        return cachedDetectionsRef.current;
      }
      lastProcessedRef.current = now;

      try {
        // Use TinyFaceDetector with smaller input size for speed
        const detections = await faceapi
          .detectAllFaces(input, new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 224, // Smaller = faster
            scoreThreshold: MIN_CONFIDENCE 
          }))
          .withFaceLandmarks(true)
          .withFaceDescriptors();

        const inputWidth = "videoWidth" in input ? input.videoWidth : input.width;
        const inputHeight = "videoHeight" in input ? input.videoHeight : input.height;

        const results = detections.map((detection, index) => {
          const { x, y, width, height } = detection.detection.box;

          // Find matching known face
          let name = "Unknown";
          let bestDistance = 1;

          for (const knownFace of knownFacesRef.current) {
            const distance = faceapi.euclideanDistance(
              detection.descriptor,
              knownFace.descriptor
            );
            if (distance < 0.55 && distance < bestDistance) {
              bestDistance = distance;
              name = knownFace.name;
            }
          }

          return {
            id: `face-${index}-${now}`,
            name,
            confidence: 1 - bestDistance,
            boundingBox: {
              x: (x / inputWidth) * 100,
              y: (y / inputHeight) * 100,
              width: (width / inputWidth) * 100,
              height: (height / inputHeight) * 100,
            },
          };
        });

        cachedDetectionsRef.current = results;
        return results;
      } catch (err) {
        console.error("[FaceAPI] Detection error:", err);
        return cachedDetectionsRef.current;
      }
    },
    [isModelLoaded]
  );

  return {
    isModelLoaded,
    isLoading,
    error,
    detectFaces,
    knownFacesCount: knownFacesRef.current.length,
  };
}
