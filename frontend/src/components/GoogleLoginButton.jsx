import { useEffect, useRef } from "react";

const GoogleLoginButton = ({ onCredential, disabled }) => {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const expectedOrigin = "http://localhost:5173";
  const isOriginMismatch = currentOrigin && currentOrigin !== expectedOrigin;

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      return;
    }

    const scriptId = "google-identity-script";

    const renderButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential && onCredential) {
            onCredential(response.credential);
          }
        },
      });

      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 320,
      });
    };

    const existing = document.getElementById(scriptId);
    if (existing) {
      renderButton();
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
  }, [clientId, onCredential]);

  if (!clientId) {
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
        Google login is disabled. Set VITE_GOOGLE_CLIENT_ID in frontend env.
      </p>
    );
  }

  return (
    <div className={disabled ? "pointer-events-none opacity-70" : ""}>
      <div ref={containerRef} className="flex justify-center" />
      
      {isOriginMismatch && (
        <div className="mt-2 rounded-xl bg-red-50 p-3 text-center text-xs font-semibold text-red-700">
          <p className="font-bold">Warning: Origin Mismatch Detected!</p>
          <p>The app is running on <span className="font-mono">{currentOrigin}</span> but Google OAuth is configured for <span className="font-mono">{expectedOrigin}</span>.</p>
          <p>This will cause a "400: origin_mismatch" error. Please ensure the app runs on port 5173.</p>
        </div>
      )}

      <p className="mt-2 text-center text-xs text-slate-500">
        If Google shows <span className="font-semibold">Error 400: origin_mismatch</span>, add this origin in
        Google Cloud OAuth settings: <span className="font-semibold">{currentOrigin}</span>
      </p>
    </div>
  );
};

export default GoogleLoginButton;
