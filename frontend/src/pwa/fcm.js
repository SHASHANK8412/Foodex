import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const initFcm = async () => {
  if (!firebaseConfig.apiKey) return null;
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });

  return { messaging, token };
};

export const onForegroundMessage = (callback) => {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
};
