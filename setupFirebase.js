const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function setupFirebase() {
  console.log("--- Firebase Setup ---");

  // --- Frontend Setup ---
  console.log("\n--- Setting up Frontend (.env) ---");
  const frontendEnvPath = path.join(__dirname, "frontend", ".env");

  const apiKey = await question("Enter your Firebase API Key: ");
  const authDomain = await question("Enter your Firebase Auth Domain: ");
  const projectId = await question("Enter your Firebase Project ID: ");
  const storageBucket = await question("Enter your Firebase Storage Bucket: ");
  const messagingSenderId = await question("Enter your Firebase Messaging Sender ID: ");
  const appId = await question("Enter your Firebase App ID: ");
  const measurementId = await question("Enter your Firebase Measurement ID (optional): ");

  let frontendEnvContent = "";
  if (fs.existsSync(frontendEnvPath)) {
    frontendEnvContent = fs.readFileSync(frontendEnvPath, "utf-8");
  }

  const updateEnv = (content, key, value) => {
    const regex = new RegExp(`^${key}=.*`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    } else {
      return `${content}\n${key}=${value}`;
    }
  };

  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_API_KEY", apiKey);
  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_AUTH_DOMAIN", authDomain);
  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_PROJECT_ID", projectId);
  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_STORAGE_BUCKET", storageBucket);
  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_MESSAGING_SENDER_ID", messagingSenderId);
  frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_APP_ID", appId);
  if (measurementId) {
    frontendEnvContent = updateEnv(frontendEnvContent, "VITE_FIREBASE_MEASUREMENT_ID", measurementId);
  }

  fs.writeFileSync(frontendEnvPath, frontendEnvContent.trim());
  console.log("✅ Frontend .env file updated successfully.");

  // --- Backend Setup ---
  console.log("\n--- Setting up Backend (.env) ---");
  const backendEnvPath = path.join(__dirname, "backend", ".env");
  const serviceAccountPath = await question("Enter the absolute path to your Firebase Service Account JSON file: ");

  if (!fs.existsSync(serviceAccountPath)) {
    console.error("\n❌ Error: Service Account file not found at the specified path.");
    rl.close();
    return;
  }

  try {
    const serviceAccountContent = fs.readFileSync(serviceAccountPath, "utf-8");
    const serviceAccountJson = JSON.stringify(JSON.parse(serviceAccountContent));

    let backendEnvContent = "";
    if (fs.existsSync(backendEnvPath)) {
      backendEnvContent = fs.readFileSync(backendEnvPath, "utf-8");
    }

    backendEnvContent = updateEnv(backendEnvContent, "FIREBASE_SERVICE_ACCOUNT", `'${serviceAccountJson}'`);

    fs.writeFileSync(backendEnvPath, backendEnvContent.trim());
    console.log("✅ Backend .env file updated successfully with Firebase Service Account.");
  } catch (error) {
    console.error("\n❌ Error processing Service Account file. Make sure it is a valid JSON file.", error);
  }


  console.log("\n🎉 Firebase setup complete!");
  rl.close();
}

setupFirebase();
