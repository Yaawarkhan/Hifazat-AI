import { useEffect, useState, useRef, useCallback } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

interface SOSState {
  isDetected: boolean;
  startTime: number | null;
  duration: number;
}

interface PoseDetectionResult {
  sosTriggered: boolean;
  armsRaised: boolean;
  duration: number;
}

const MEDIAPIPE_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// SOS trigger duration in milliseconds (3 seconds)
const SOS_TRIGGER_DURATION = 3000;

export function usePoseDetection() {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const sosStateRef = useRef<SOSState>({ isDetected: false, startTime: null, duration: 0 });
  const lastProcessedTimeRef = useRef<number>(0);

  // Load MediaPipe Pose model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        console.log("[PoseDetection] Loading MediaPipe Pose Landmarker...");

        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: "GPU", // Use GPU for better performance
          },
          runningMode: "VIDEO",
          numPoses: 1, // Only track 1 person for SOS
          minPoseDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        poseLandmarkerRef.current = poseLandmarker;
        setIsModelLoaded(true);
        console.log("[PoseDetection] Pose Landmarker loaded successfully");
      } catch (err) {
        console.error("[PoseDetection] Failed to load model:", err);
        setError("Failed to load pose detection model");
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();

    return () => {
      poseLandmarkerRef.current?.close();
    };
  }, []);

  // Check if both arms are raised (wrist above shoulder)
  const checkArmsRaised = useCallback((landmarks: any[]): boolean => {
    if (!landmarks || landmarks.length < 17) return false;

    // MediaPipe Pose landmarks:
    // 11 = left_shoulder, 12 = right_shoulder
    // 15 = left_wrist, 16 = right_wrist
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) return false;

    // In screen coordinates, y=0 is top, so wrist.y < shoulder.y means raised
    const leftArmRaised = leftWrist.y < leftShoulder.y;
    const rightArmRaised = rightWrist.y < rightShoulder.y;

    return leftArmRaised && rightArmRaised;
  }, []);

  // Detect pose and check for SOS gesture
  const detectPose = useCallback(
    async (
      input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
    ): Promise<PoseDetectionResult> => {
      if (!isModelLoaded || !poseLandmarkerRef.current) {
        return { sosTriggered: false, armsRaised: false, duration: 0 };
      }

      const now = performance.now();
      
      // Throttle to max 15 FPS for pose detection
      if (now - lastProcessedTimeRef.current < 66) {
        return { 
          sosTriggered: false, 
          armsRaised: sosStateRef.current.isDetected, 
          duration: sosStateRef.current.duration 
        };
      }
      lastProcessedTimeRef.current = now;

      try {
        const results = poseLandmarkerRef.current.detectForVideo(input as HTMLVideoElement, now);
        
        if (results.landmarks && results.landmarks.length > 0) {
          const armsRaised = checkArmsRaised(results.landmarks[0]);
          
          if (armsRaised) {
            if (!sosStateRef.current.startTime) {
              sosStateRef.current.startTime = Date.now();
            }
            sosStateRef.current.duration = Date.now() - sosStateRef.current.startTime;
            sosStateRef.current.isDetected = true;

            // Check if SOS has been held for 3 seconds
            if (sosStateRef.current.duration >= SOS_TRIGGER_DURATION) {
              return { sosTriggered: true, armsRaised: true, duration: sosStateRef.current.duration };
            }
          } else {
            // Reset SOS state
            sosStateRef.current = { isDetected: false, startTime: null, duration: 0 };
          }

          return { 
            sosTriggered: false, 
            armsRaised, 
            duration: sosStateRef.current.duration 
          };
        }

        // No pose detected, reset
        sosStateRef.current = { isDetected: false, startTime: null, duration: 0 };
        return { sosTriggered: false, armsRaised: false, duration: 0 };
      } catch (err) {
        console.error("[PoseDetection] Detection error:", err);
        return { sosTriggered: false, armsRaised: false, duration: 0 };
      }
    },
    [isModelLoaded, checkArmsRaised]
  );

  // Reset SOS state manually
  const resetSOSState = useCallback(() => {
    sosStateRef.current = { isDetected: false, startTime: null, duration: 0 };
  }, []);

  return {
    isModelLoaded,
    isLoading,
    error,
    detectPose,
    resetSOSState,
  };
}
