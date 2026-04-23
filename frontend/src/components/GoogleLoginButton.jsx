import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";

const GoogleLoginButton = ({ onCredential, disabled }) => {
  const [firebaseError, setFirebaseError] = useState("");

  const handleGoogleSignIn = async () => {
    setFirebaseError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = credential?.idToken;

      if (!idToken) {
        setFirebaseError("Google sign-in failed: missing id token.");
        return;
      }

      if (onCredential) {
        onCredential(idToken);
      }
    } catch (error) {
      setFirebaseError(error?.message || "Google sign-in failed. Please try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={disabled}
        className="w-full rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        Continue with Google
      </button>

      {firebaseError && (
        <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{firebaseError}</p>
      )}
    </>
  );
};

export default GoogleLoginButton;
