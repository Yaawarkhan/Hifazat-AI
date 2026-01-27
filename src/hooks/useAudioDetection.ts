import { useEffect, useState, useRef, useCallback } from "react";

// YAMNet threat classes
const THREAT_SOUNDS = [
  "Scream", "Screaming", "Shout", "Yell",
  "Explosion", "Burst, pop", "Bang",
  "Shatter", "Glass", "Breaking", "Crash",
  "Gunshot, gunfire", "Machine gun", "Firearms",
  "Crying, sobbing", "Whimper",
  "Alarm", "Siren", "Emergency vehicle",
];

// Calculate frequency variance for audio analysis
function calculateFrequencyVariance(buffer: Float32Array): number {
  const fft = new Float32Array(256);
  for (let i = 0; i < Math.min(buffer.length, 256); i++) {
    fft[i] = Math.abs(buffer[i]);
  }
  const mean = fft.reduce((a, b) => a + b, 0) / fft.length;
  const variance = fft.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fft.length;
  return Math.sqrt(variance);
}

interface AudioDetectionResult {
  topClass: string;
  confidence: number;
  isThreat: boolean;
  allPredictions: Array<{ class: string; confidence: number }>;
}

interface UseAudioDetectionOptions {
  enabled?: boolean;
  sampleRate?: number;
  confidenceThreshold?: number;
  onThreatDetected?: (result: AudioDetectionResult) => void;
}

export function useAudioDetection(options: UseAudioDetectionOptions = {}) {
  const {
    enabled = false,
    sampleRate = 16000,
    confidenceThreshold = 0.3,
    onThreatDetected,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soundLevel, setSoundLevel] = useState(0);
  const [lastPrediction, setLastPrediction] = useState<AudioDetectionResult | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const lastProcessTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const onThreatDetectedRef = useRef(onThreatDetected);

  // Keep the callback ref up to date
  useEffect(() => {
    onThreatDetectedRef.current = onThreatDetected;
  }, [onThreatDetected]);

  // Process audio buffer with simulated YAMNet
  const processAudioBuffer = useCallback((buffer: Float32Array): AudioDetectionResult => {
    // Calculate RMS for sound level
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);

    // Simulate threat detection based on audio characteristics
    const hasHighAmplitude = rms > 0.1;
    const frequencyVariance = calculateFrequencyVariance(buffer);
    const hasHighVariance = frequencyVariance > 0.5;

    // Demo predictions - in production, use actual YAMNet inference
    let topClass = "Background noise";
    let confidence = 0.2 + Math.random() * 0.3;
    let isThreat = false;

    if (hasHighAmplitude && hasHighVariance) {
      const threatIndex = Math.floor(Math.random() * THREAT_SOUNDS.length);
      topClass = THREAT_SOUNDS[threatIndex];
      confidence = 0.4 + Math.random() * 0.5;
      isThreat = confidence > confidenceThreshold;
    } else if (hasHighAmplitude) {
      topClass = "Speech";
      confidence = 0.5 + Math.random() * 0.3;
    }

    return {
      topClass,
      confidence,
      isThreat,
      allPredictions: [
        { class: topClass, confidence },
        { class: "Background noise", confidence: 0.1 + Math.random() * 0.2 },
      ],
    };
  }, [confidenceThreshold]);

  // Stop audio detection
  const stopListening = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    setSoundLevel(0);
    console.log("[AudioDetection] Stopped listening");
  }, []);

  // Start audio detection
  const startListening = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: sampleRate },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate });
      audioContextRef.current = audioContext;

      // Create analyzer for sound level
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 2048;
      analyzerRef.current = analyzer;

      // Connect microphone to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyzer);

      // Create script processor for audio processing
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        const now = Date.now();
        // Process every 960ms (YAMNet frame size)
        if (now - lastProcessTimeRef.current >= 960) {
          lastProcessTimeRef.current = now;
          
          const inputData = event.inputBuffer.getChannelData(0);
          const buffer = new Float32Array(inputData);
          
          const result = processAudioBuffer(buffer);
          setLastPrediction(result);
          
          // Update sound level
          const dataArray = new Uint8Array(analyzer.frequencyBinCount);
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          const normalized = Math.min(100, (average / 255) * 100 * 2);
          setSoundLevel(normalized);
          
          if (result.isThreat && onThreatDetectedRef.current) {
            onThreatDetectedRef.current(result);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      setIsModelLoaded(true);
      setIsLoading(false);

      console.log("[AudioDetection] Started listening");
    } catch (err) {
      console.error("[AudioDetection] Failed to start:", err);
      setError("Microphone access denied");
      setIsLoading(false);
    }
  }, [sampleRate, processAudioBuffer]);

  // Simulate a threat for testing
  const simulateThreat = useCallback(() => {
    const threatIndex = Math.floor(Math.random() * 3);
    const threats = ["Scream", "Explosion", "Gunshot, gunfire"];
    const result: AudioDetectionResult = {
      topClass: threats[threatIndex],
      confidence: 0.75 + Math.random() * 0.2,
      isThreat: true,
      allPredictions: [
        { class: threats[threatIndex], confidence: 0.85 },
        { class: "Background noise", confidence: 0.1 },
      ],
    };
    setLastPrediction(result);
    if (onThreatDetectedRef.current) {
      onThreatDetectedRef.current(result);
    }
    return result;
  }, []);

  // Auto-start when enabled changes
  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
  }, [enabled]); // Intentionally minimal deps to prevent infinite loops

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isModelLoaded,
    isLoading,
    error,
    soundLevel,
    lastPrediction,
    startListening,
    stopListening,
    simulateThreat,
  };
}
