import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { googleMapsLoader } from "./googleMapsLoader";
import InfoWindowContent from "./InfoWindowContent";

const mapContainerStyle = {
  width: "100%",
  height: "100vh",
};

function getMarkerStyle(percentage) {
  const config = {
    "10%": { bg: "#ef4444", glow: "rgba(239, 68, 68, 0.20)" },
    "50%": { bg: "#f97316", glow: "rgba(249, 115, 22, 0.20)" },
    "75%": { bg: "#37ac62", glow: "rgba(34, 197, 94, 0.20)" },
  };

  return (
    config[percentage] || {
      bg: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.20)",
    }
  );
}

function createPinElement(markerData) {
  const { bg, glow } = getMarkerStyle(markerData.percentage);

  const pin = document.createElement("div");
  pin.style.display = "flex";
  pin.style.flexDirection = "column";
  pin.style.alignItems = "center";
  pin.style.cursor = "pointer";
  pin.style.transform = "translateY(-4px)";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "30");
  svg.setAttribute("height", "42");
  svg.setAttribute("viewBox", "0 0 30 42");
  svg.style.overflow = "visible";
  svg.style.transition = "transform 140ms ease, filter 140ms ease";
  svg.style.filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.22)) drop-shadow(0 0 8px ${glow})`;

  const pinShape = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  pinShape.setAttribute(
    "d",
    "M15 1.5C8.1 1.5 2.5 7 2.5 13.8C2.5 22.9 15 40 15 40C15 40 27.5 22.9 27.5 13.8C27.5 7 21.9 1.5 15 1.5Z",
  );
  pinShape.setAttribute("fill", bg);
  pinShape.setAttribute("stroke", "#ffffff");
  pinShape.setAttribute("stroke-width", "2");

  const innerTint = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  innerTint.setAttribute(
    "d",
    "M15 4.5C9.7 4.5 5.5 8.8 5.5 14C5.5 20.8 15 34.2 15 34.2C15 34.2 24.5 20.8 24.5 14C24.5 8.8 20.3 4.5 15 4.5Z",
  );
  innerTint.setAttribute("fill", "rgba(255,255,255,0.08)");

  const centerDot = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  centerDot.setAttribute("cx", "15");
  centerDot.setAttribute("cy", "13.8");
  centerDot.setAttribute("r", "4.7");
  centerDot.setAttribute("fill", "#ffffff");
  centerDot.setAttribute("opacity", "0.98");

  const centerRing = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  centerRing.setAttribute("cx", "15");
  centerRing.setAttribute("cy", "13.8");
  centerRing.setAttribute("r", "5.6");
  centerRing.setAttribute("fill", "none");
  centerRing.setAttribute("stroke", "rgba(255,255,255,0.35)");
  centerRing.setAttribute("stroke-width", "1");

  svg.appendChild(pinShape);
  svg.appendChild(innerTint);
  svg.appendChild(centerRing);
  svg.appendChild(centerDot);

  pin.appendChild(svg);

  pin.addEventListener("mouseenter", () => {
    svg.style.transform = "translateY(-1px) scale(1.06)";
    svg.style.filter = `drop-shadow(0 4px 8px rgba(0,0,0,0.26)) drop-shadow(0 0 12px ${glow})`;
  });

  pin.addEventListener("mouseleave", () => {
    svg.style.transform = "translateY(0) scale(1)";
    svg.style.filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.22)) drop-shadow(0 0 8px ${glow})`;
  });

  return pin;
}

export default function Map() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const infoWindowRef = useRef(null);
  const markerInstancesRef = useRef([]);
  const mapClickListenerRef = useRef(null);
  const infoWindowRootRef = useRef(null);

  const [markers, setMarkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchMarkers() {
      try {
        setLoading(true);
        setError("");

        const API_URL = import.meta.env.VITE_API_URL;
        const response = await fetch(`${API_URL}/api/locations`);

        if (!response.ok) {
          const text = await response.text();
          throw new Error(
            `Failed to fetch markers: ${response.status} ${text}`,
          );
        }

        const data = await response.json();

        if (!cancelled) {
          setMarkers(Array.isArray(data.markers) ? data.markers : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load markers");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchMarkers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!mapRef.current) return;

      try {
        await googleMapsLoader();

        if (cancelled || !window.google?.maps) return;

        const { Map: GoogleMap, InfoWindow } =
          await window.google.maps.importLibrary("maps");
        await window.google.maps.importLibrary("marker");

        const map = new GoogleMap(mapRef.current, {
          center: { lat: 39.7392, lng: -104.9903 },
          zoom: 10,
          mapId: "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          styles: [
            {
              featureType: "poi",
              stylers: [{ visibility: "off" }],
            },
            {
              featureType: "transit",
              stylers: [{ visibility: "off" }],
            },
          ],
        });

        mapInstanceRef.current = map;
        infoWindowRef.current = new InfoWindow();
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to initialize map");
          setLoading(false);
        }
      }
    }

    initMap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;

    if (!map || !infoWindow || !window.google?.maps) return;

    markerInstancesRef.current.forEach((marker) => {
      marker.map = null;
    });
    markerInstancesRef.current = [];

    if (mapClickListenerRef.current) {
      window.google.maps.event.removeListener(mapClickListenerRef.current);
      mapClickListenerRef.current = null;
    }

    if (infoWindowRootRef.current) {
      infoWindowRootRef.current.unmount();
      infoWindowRootRef.current = null;
    }

    if (!markers.length) {
      infoWindow.close();
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();

    markers.forEach((markerData) => {
      if (
        typeof markerData.lat !== "number" ||
        typeof markerData.lng !== "number"
      ) {
        return;
      }

      const pinContent = createPinElement(markerData);

      const advancedMarker =
        new window.google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: markerData.lat, lng: markerData.lng },
          content: pinContent,
          title: markerData.name || "Project marker",
        });

      advancedMarker.addListener("click", () => {
        if (infoWindowRootRef.current) {
          infoWindowRootRef.current.unmount();
          infoWindowRootRef.current = null;
        }

        const container = document.createElement("div");
        const root = createRoot(container);
        infoWindowRootRef.current = root;

        root.render(<InfoWindowContent markerData={markerData} />);

        infoWindow.setContent(container);
        infoWindow.open({
          map,
          anchor: advancedMarker,
        });
      });

      markerInstancesRef.current.push(advancedMarker);
      bounds.extend({ lat: markerData.lat, lng: markerData.lng });
    });

    mapClickListenerRef.current = map.addListener("click", () => {
      infoWindow.close();

      if (infoWindowRootRef.current) {
        infoWindowRootRef.current.unmount();
        infoWindowRootRef.current = null;
      }
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);

      window.google.maps.event.addListenerOnce(map, "bounds_changed", () => {
        const zoom = map.getZoom();
        if (zoom > 14) {
          map.setZoom(14);
        }
      });
    }

    return () => {
      markerInstancesRef.current.forEach((marker) => {
        marker.map = null;
      });
      markerInstancesRef.current = [];

      infoWindow.close();

      if (infoWindowRootRef.current) {
        infoWindowRootRef.current.unmount();
        infoWindowRootRef.current = null;
      }

      if (mapClickListenerRef.current) {
        window.google.maps.event.removeListener(mapClickListenerRef.current);
        mapClickListenerRef.current = null;
      }
    };
  }, [markers]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div ref={mapRef} style={mapContainerStyle} />

      {loading && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            background: "rgba(17, 24, 39, 0.92)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
          }}
        >
          Loading map data...
        </div>
      )}

      {error && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            background: "rgba(127, 29, 29, 0.94)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
            maxWidth: "420px",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
