import { Workbox } from "workbox-window";

export const registerPwa = () => {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  const wb = new Workbox("/sw.js");
  wb.register();
};
