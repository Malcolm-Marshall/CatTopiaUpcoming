import { useEffect, useRef } from "react";
import { googleMapsLoader } from "./googleMapsLoader";

let initialized = false;

export default function BuildMap() {
  const mapDivRef = useRef(null);

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    (async () => {
      await googleMapsLoader();

      new window.google.maps.Map(mapDivRef.current, {
        center: { lat: 39.7392, lng: -104.9903 },
        zoom: 10,
      });
    })().catch(console.error);
  }, []);

  return <div ref={mapDivRef} style={{ height: "100vh", width: "100%" }} />;
}