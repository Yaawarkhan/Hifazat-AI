import { useState, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { MapPin, Camera, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CameraFeed, CampusStatus } from "@/types/detection";
import { cn } from "@/lib/utils";

interface CampusMapProps {
  cameras: CameraFeed[];
  selectedCameraId: string | null;
  onCameraSelect: (cameraId: string) => void;
  campusStatus: CampusStatus;
  threatLocations?: { cameraId: string; active: boolean }[];
}

// AMU Campus center coordinates
const AMU_CENTER = { lat: 27.9154, lng: 78.0681 };

// Camera locations on AMU campus
const CAMERA_LOCATIONS: Record<string, { lat: number; lng: number; name: string }> = {
  "mobile-cam": { lat: 27.9128, lng: 78.0648, name: "Centenary Gate" },
  "cam-2": { lat: 27.9168, lng: 78.0695, name: "Maulana Azad Library" },
  "cam-3": { lat: 27.9145, lng: 78.0720, name: "Administrative Building" },
  "cam-4": { lat: 27.9190, lng: 78.0660, name: "North Campus Parking" },
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  minHeight: "200px",
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      elementType: "geometry",
      stylers: [{ color: "#1a1a2e" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#1a1a2e" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#8b8b8b" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#2d2d44" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1a1a2e" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#0e0e1a" }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#16213e" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#1a3a1a" }],
    },
  ],
};

export function CampusMap({
  cameras,
  selectedCameraId,
  onCameraSelect,
  campusStatus,
  threatLocations = [],
}: CampusMapProps) {
  const [hoveredCamera, setHoveredCamera] = useState<string | null>(null);
  
  // Use the Google Maps API key from environment or a placeholder
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  const getMarkerIcon = useCallback(
    (camera: CameraFeed) => {
      const hasThreat = threatLocations.some(
        (t) => t.cameraId === camera.id && t.active
      );
      const isSelected = camera.id === selectedCameraId;
      const isOnline = camera.status === "online";

      let color = "#22c55e"; // Green for online
      if (hasThreat) color = "#ef4444"; // Red for threat
      else if (!isOnline) color = "#6b7280"; // Gray for offline
      else if (isSelected) color = "#3b82f6"; // Blue for selected

      return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: isSelected ? 3 : 2,
        scale: isSelected ? 12 : hasThreat ? 14 : 10,
      };
    },
    [selectedCameraId, threatLocations]
  );

  const markers = useMemo(() => {
    return cameras.map((camera) => {
      const location = CAMERA_LOCATIONS[camera.id];
      if (!location) return null;

      const hasThreat = threatLocations.some(
        (t) => t.cameraId === camera.id && t.active
      );

      return {
        camera,
        position: { lat: location.lat, lng: location.lng },
        hasThreat,
      };
    }).filter(Boolean);
  }, [cameras, threatLocations]);

  if (loadError) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground p-4">
          <AlertTriangle className="mx-auto h-8 w-8 mb-2 text-status-alert" />
          <p className="text-sm">Failed to load Google Maps</p>
          <p className="text-xs mt-1">Add VITE_GOOGLE_MAPS_API_KEY to enable</p>
        </div>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2 text-sm">Loading map...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300",
      campusStatus === "lockdown" && "ring-2 ring-status-lockdown animate-pulse"
    )}>
      <CardHeader className="border-b py-2 px-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-primary" />
          AMU Campus Map
          <span className={cn(
            "ml-auto px-2 py-0.5 rounded-full text-xs font-medium",
            campusStatus === "secure" && "bg-status-secure/20 text-status-secure",
            campusStatus === "alert" && "bg-status-alert/20 text-status-alert",
            campusStatus === "lockdown" && "bg-status-lockdown/20 text-status-lockdown"
          )}>
            {campusStatus.toUpperCase()}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 h-48">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={AMU_CENTER}
          zoom={15}
          options={mapOptions}
        >
          {markers.map((marker) => {
            if (!marker) return null;
            const { camera, position, hasThreat } = marker;

            return (
              <Marker
                key={camera.id}
                position={position}
                icon={getMarkerIcon(camera)}
                onClick={() => onCameraSelect(camera.id)}
                onMouseOver={() => setHoveredCamera(camera.id)}
                onMouseOut={() => setHoveredCamera(null)}
                animation={hasThreat ? google.maps.Animation.BOUNCE : undefined}
              >
                {hoveredCamera === camera.id && (
                  <InfoWindow onCloseClick={() => setHoveredCamera(null)}>
                    <div className="p-1 text-foreground bg-card">
                      <p className="font-medium text-sm">{camera.name}</p>
                      <p className="text-xs text-muted-foreground">{camera.location}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Camera className="h-3 w-3" />
                        <span className={cn(
                          "text-xs",
                          camera.status === "online" ? "text-status-secure" : "text-muted-foreground"
                        )}>
                          {camera.status}
                        </span>
                        {hasThreat && (
                          <span className="text-xs text-status-lockdown ml-2">⚠️ THREAT</span>
                        )}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Marker>
            );
          })}
        </GoogleMap>
      </CardContent>
    </Card>
  );
}
