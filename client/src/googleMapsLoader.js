let loadingPromise;

export function googleMapsLoader() {
  if (loadingPromise) return loadingPromise;

  const apiKey = import.meta.env.VITE_MAPS_JS_API_KEY;
  if (!apiKey) throw new Error("Missing VITE_MAPS_JS_API_KEY");

  // Already loaded?
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.onerror = reject;
    script.onload = () => resolve(window.google.maps);
    document.head.appendChild(script);
  });

  return loadingPromise;
}