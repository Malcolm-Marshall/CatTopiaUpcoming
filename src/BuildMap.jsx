import { useEffect, useRef } from "react";
import { googleMapsLoader } from "./googleMapsLoader";

let initialized = false;

function getMarkerColor(percentage) {
  switch (percentage) {
    case "10%":
      return "red";
    case "50%":
      return "orange";
    case "75%":
      return "yellow";
    default:
      return "blue";
  }
}

export default function BuildMap() {
  const mapDivRef = useRef(null);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    (async () => {
      await googleMapsLoader();

      const map = new window.google.maps.Map(mapDivRef.current, {
        center: { lat: 39.7392, lng: -104.9903 },
        zoom: 8,
      });

      const res = await fetch("/api/locations");
      if (!res.ok) {
        throw new Error(`Failed to fetch locations: ${res.status}`);
      }

      const data = await res.json();
      const locations = data.markers || [];

      const bounds = new window.google.maps.LatLngBounds();

      for (const loc of locations) {
        const marker = new window.google.maps.Marker({
          map,
          position: { lat: loc.lat, lng: loc.lng },
          title: `${loc.name} - ${loc.percentage}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: getMarkerColor(loc.percentage),
            fillOpacity: 1,
            strokeColor: "white",
            strokeWeight: 1,
          },
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="min-width: 220px;">
              <h3 style="margin: 0 0 8px 0;">${loc.name}</h3>
              <p style="margin: 4px 0;"><strong>Matched Name:</strong> ${loc.matchedName}</p>
              <p style="margin: 4px 0;"><strong>Percentage:</strong> ${loc.percentage}</p>
              <p style="margin: 4px 0;"><strong>Address:</strong> ${loc.address}</p>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open({
            anchor: marker,
            map,
          });
        });

        bounds.extend({ lat: loc.lat, lng: loc.lng });
      }

      if (locations.length > 0) {
        map.fitBounds(bounds);
      }

      console.log("Unmatched names:", data.unmatchedNames);
      console.log("Counts:", data.counts);
    })().catch((err) => {
      console.error("Map load error:", err);
    });
  }, []);

  return <div ref={mapDivRef} style={{ height: "100vh", width: "100%" }} />;
}