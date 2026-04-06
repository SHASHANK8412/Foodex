import { useEffect, useRef } from "react";

const GoogleLoginButton = ({ onCredential, disabled }) => {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

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
    </div>
  );
};

export default GoogleLoginButton;
