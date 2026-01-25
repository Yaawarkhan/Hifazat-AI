import { useEffect, useState, useRef, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";

// YAMNet threat classes
const THREAT_SOUNDS = [
  "Scream", "Screaming", "Shout", "Yell",
  "Explosion", "Burst, pop", "Bang",
  "Shatter", "Glass", "Breaking", "Crash",
  "Gunshot, gunfire", "Machine gun", "Firearms",
  "Crying, sobbing", "Whimper",
  "Alarm", "Siren", "Emergency vehicle",
];

// YAMNet class labels (subset for threat detection)
const YAMNET_CLASSES: Record<number, string> = {
  0: "Speech",
  1: "Child speech, kid speaking",
  20: "Crying, sobbing",
  21: "Whimper",
  22: "Wail, moan",
  23: "Sigh",
  24: "Singing",
  40: "Laughter",
  60: "Shout",
  61: "Bellow",
  62: "Whoop",
  63: "Yell",
  64: "Battle cry",
  65: "Children shouting",
  66: "Screaming",
  72: "Breathing",
  400: "Glass",
  401: "Shatter",
  402: "Clink",
  426: "Explosion",
  427: "Burst, pop",
  428: "Eruption",
  429: "Boom",
  430: "Bang",
  431: "Gunshot, gunfire",
  432: "Machine gun",
  433: "Fusillade",
  500: "Alarm",
  501: "Siren",
  502: "Civil defense siren",
  503: "Buzzer",
  504: "Alarm clock",
  505: "Smoke detector, smoke alarm",
  506: "Fire alarm",
};

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

export function useAudioDetection({
  enabled = false,
  sampleRate = 16000,
  confidenceThreshold = 0.3,
  onThreatDetected,
}: UseAudioDetectionOptions = {}) {
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
  const audioBufferRef = useRef<Float32Array[]>([]);
  const lastProcessTimeRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Process audio buffer with simulated YAMNet
  const processAudioBuffer = useCallback(async (buffer: Float32Array): Promise<AudioDetectionResult> => {
    // Simulated YAMNet inference
    // In production, load the actual YAMNet model from TFHub
    
    // Calculate RMS for sound level
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sum / buffer.length);
    const db = 20 * Math.log10(rms + 0.0001);
    const normalizedLevel = Math.max(0, Math.min(100, (db + 60) * 1.5));
    setSoundLevel(normalizedLevel);

    // Simulate threat detection based on audio characteristics
    // High amplitude + high frequency variance could indicate screams/explosions
    const hasHighAmplitude = rms > 0.1;
    const frequencyVariance = calculateFrequencyVariance(buffer);
    const hasHighVariance = frequencyVariance > 0.5;

    // Demo predictions - in production, use actual YAMNet inference
    let topClass = "Background noise";
    let confidence = 0.2 + Math.random() * 0.3;
    let isThreat = false;

    if (hasHighAmplitude && hasHighVariance) {
      // Simulate threat detection for demo
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

  // Calculate frequency variance for audio analysis
  const calculateFrequencyVariance = (buffer: Float32Array): number => {
    const fft = new Float32Array(256);
    for (let i = 0; i < Math.min(buffer.length, 256); i++) {
      fft[i] = Math.abs(buffer[i]);
    }
    const mean = fft.reduce((a, b) => a + b, 0) / fft.length;
    const variance = fft.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fft.length;
    return Math.sqrt(variance);
  };

  // Update sound level meter
  const updateSoundLevel = useCallback(() => {
    if (!analyzerRef.current || !isListening) return;

    const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const normalized = Math.min(100, (average / 255) * 100 * 2);
    setSoundLevel(normalized);

    animationFrameRef.current = requestAnimationFrame(updateSoundLevel);
  }, [isListening]);

  // Start audio detection
  const startListening = useCallback(async () => {
    if (isListening) return;

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

      processor.onaudioprocess = async (event) => {
        const now = Date.now();
        // Process every 960ms (YAMNet frame size)
        if (now - lastProcessTimeRef.current >= 960) {
          lastProcessTimeRef.current = now;
          
          const inputData = event.inputBuffer.getChannelData(0);
          const buffer = new Float32Array(inputData);
          
          const result = await processAudioBuffer(buffer);
          setLastPrediction(result);
          
          if (result.isThreat && onThreatDetected) {
            onThreatDetected(result);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsListening(true);
      setIsModelLoaded(true);
      setIsLoading(false);

      // Start sound level animation
      updateSoundLevel();

      console.log("[AudioDetection] Started listening");
    } catch (err) {
      console.error("[AudioDetection] Failed to start:", err);
      setError("Microphone access denied");
      setIsLoading(false);
    }
  }, [isListening, sampleRate, processAudioBuffer, onThreatDetected, updateSoundLevel]);

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
    if (onThreatDetected) {
      onThreatDetected(result);
    }
    return result;
  }, [onThreatDetected]);

  // Auto-start when enabled changes
  useEffect(() => {
    if (enabled && !isListening) {
      startListening();
    } else if (!enabled && isListening) {
      stopListening();
    }
  }, [enabled, isListening, startListening, stopListening]);

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
