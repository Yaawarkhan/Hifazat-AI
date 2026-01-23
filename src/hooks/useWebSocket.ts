import { useEffect, useRef, useState, useCallback } from "react";
import type { WebSocketMessage, CameraFeed, AlertEvent, CampusStatus } from "@/types/detection";

interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  reconnectInterval?: number;
  maxRetries?: number;
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  retryCount: number;
}

export function useWebSocket({
  url,
  onMessage,
  reconnectInterval = 3000,
  maxRetries = 5,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    retryCount: 0,
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WebSocket] Connected to:", url);
        setState({
          isConnected: true,
          isConnecting: false,
          error: null,
          retryCount: 0,
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          onMessage?.(message);
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("[WebSocket] Error:", error);
        setState((prev) => ({
          ...prev,
          error: "Connection error",
          isConnecting: false,
        }));
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        // Attempt reconnection
        if (state.retryCount < maxRetries) {
          reconnectTimeoutRef.current = setTimeout(() => {
            setState((prev) => ({ ...prev, retryCount: prev.retryCount + 1 }));
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      console.error("[WebSocket] Failed to connect:", err);
      setState((prev) => ({
        ...prev,
        error: "Failed to establish connection",
        isConnecting: false,
      }));
    }
  }, [url, onMessage, reconnectInterval, maxRetries, state.retryCount]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState({
      isConnected: false,
      isConnecting: false,
      error: null,
      retryCount: 0,
    });
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    send,
  };
}

// Demo mode hook - simulates WebSocket data for testing UI
export function useDemoMode() {
  const [cameras, setCameras] = useState<CameraFeed[]>([
    {
      id: "mobile-cam",
      name: "Main Gate (Mobile)",
      location: "Centenary Gate",
      status: "online",
      detections: [],
    },
    {
      id: "cam-2",
      name: "Library Entrance",
      location: "Maulana Azad Library",
      status: "online",
      detections: [],
    },
    {
      id: "cam-3",
      name: "Admin Block",
      location: "Administrative Building",
      status: "online",
      detections: [],
    },
    {
      id: "cam-4",
      name: "Parking Lot A",
      location: "North Campus Parking",
      status: "online",
      detections: [],
    },
  ]);

  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [campusStatus, setCampusStatus] = useState<CampusStatus>("secure");

  const addAlert = useCallback((alert: Omit<AlertEvent, "id" | "timestamp" | "acknowledged">) => {
    const newAlert: AlertEvent = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: Date.now(),
      acknowledged: false,
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
    
    if (alert.type === "threat") {
      setCampusStatus("lockdown");
    } else if (alert.type === "sos" || alert.type === "intrusion") {
      setCampusStatus("alert");
    }
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
    );
  }, []);

  const resetStatus = useCallback(() => {
    setCampusStatus("secure");
  }, []);

  return {
    cameras,
    setCameras,
    alerts,
    addAlert,
    acknowledgeAlert,
    campusStatus,
    setCampusStatus,
    resetStatus,
  };
}
