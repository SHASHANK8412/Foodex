const DEFAULT_API_BASE_URL = "http://localhost:5001/api";

const getBackendOrigin = () => {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim();
  // Convert e.g. http://localhost:5001/api -> http://localhost:5001
  return apiBase.replace(/\/+$/, "").replace(/\/api$/, "").replace(/\/api\/$/, "");
};

export const resolveImageUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return raw;

  const origin = getBackendOrigin();
  if (!origin) return raw;

  if (raw.startsWith("/")) return origin + raw;
  return origin + "/" + raw;
};

export const FALLBACK_RESTAURANT_IMAGE_REMOTE =
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80";

export const FALLBACK_RESTAURANT_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.18"/>
      <stop offset="55%" stop-color="#f59e0b" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.70"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <circle cx="260" cy="170" r="160" fill="#fb7185" opacity="0.12"/>
  <circle cx="940" cy="210" r="220" fill="#fbbf24" opacity="0.10"/>
  <circle cx="650" cy="560" r="260" fill="#22c55e" opacity="0.08"/>

  <rect x="140" y="170" width="920" height="335" rx="44" fill="url(#card)"/>
  <text x="200" y="310" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="56" font-weight="800" fill="#0f172a" opacity="0.88">FoodEx</text>
  <text x="200" y="372" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" font-size="26" font-weight="600" fill="#0f172a" opacity="0.55">Restaurant</text>
  <rect x="200" y="410" width="360" height="18" rx="9" fill="#0f172a" opacity="0.10"/>
  <rect x="200" y="440" width="280" height="18" rx="9" fill="#0f172a" opacity="0.08"/>
</svg>`);
