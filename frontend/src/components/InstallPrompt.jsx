import { useEffect, useState } from "react";

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 rounded-2xl bg-slate-900 text-white p-4 shadow-xl">
      <p className="text-sm mb-2">Install Foodex for full offline experience.</p>
      <button onClick={install} className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold">Install App</button>
    </div>
  );
};

export default InstallPrompt;
