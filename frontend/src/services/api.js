import axios from "axios";

// Production builds default to the same origin (nginx proxies /api in the Docker image).
const baseURL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

const api = axios.create({
  baseURL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("foodex_token");
  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || "Request failed";
    // Keep the status and details (e.g. which checks failed) for callers that show them.
    return Promise.reject(
      Object.assign(new Error(message), {
        status: error.response?.status,
        details: error.response?.data?.details || null,
      })
    );
  }
);

export default api;
