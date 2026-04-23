import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDxXtXUJp2fFs1RpCUb_1bOxzYT5oaLnUQ",
  authDomain: "foodex-b2e38.firebaseapp.com",
  projectId: "foodex-b2e38",
  storageBucket: "foodex-b2e38.firebasestorage.app",
  messagingSenderId: "572362537502",
  appId: "1:572362537502:web:88b0767b1e917b4ce80c0f",
  measurementId: "G-D14QZ5SYGZ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const initAnalytics = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  const supported = await isSupported();
  if (!supported) {
    return null;
  }

  return getAnalytics(app);
};

void initAnalytics();

export { app, auth, googleProvider, initAnalytics };
