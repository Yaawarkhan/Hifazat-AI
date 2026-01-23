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

export function useFaceRecognition() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const knownFacesRef = useRef<KnownFace[]>([]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[FaceAPI] Loading models from CDN...");

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);

        console.log("[FaceAPI] Models loaded successfully");

        // Load known faces
        console.log("[FaceAPI] Loading known faces...");
        for (const face of KNOWN_FACES) {
          try {
            const img = await faceapi.fetchImage(face.imagePath);
            const detection = await faceapi
              .detectSingleFace(img)
              .withFaceLandmarks()
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

  // Detect faces in an image/video element
  const detectFaces = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<FaceDetection[]> => {
      if (!isModelLoaded) return [];

      try {
        const detections = await faceapi
          .detectAllFaces(input)
          .withFaceLandmarks()
          .withFaceDescriptors();

        const inputWidth = "videoWidth" in input ? input.videoWidth : input.width;
        const inputHeight = "videoHeight" in input ? input.videoHeight : input.height;

        return detections.map((detection, index) => {
          const { x, y, width, height } = detection.detection.box;

          // Find matching known face
          let name = "Unknown";
          let bestDistance = 1;

          for (const knownFace of knownFacesRef.current) {
            const distance = faceapi.euclideanDistance(
              detection.descriptor,
              knownFace.descriptor
            );
            if (distance < 0.6 && distance < bestDistance) {
              bestDistance = distance;
              name = knownFace.name;
            }
          }

          return {
            id: `face-${index}`,
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
      } catch (err) {
        console.error("[FaceAPI] Detection error:", err);
        return [];
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
