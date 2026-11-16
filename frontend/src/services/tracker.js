import api from "./api";

// Clickstream tracker: batches browsing events and posts them to /api/events,
// where the API publishes them to the Kafka `foodex.clickstream` topic.
// Tracking must never get in the user's way, so every failure is swallowed.

const SESSION_KEY = "foodex_session_id";
const FLUSH_INTERVAL_MS = 8000;
const MAX_BATCH = 20;

let queue = [];
let timer = null;

const newSessionId = () =>
  globalThis.crypto?.randomUUID?.() || `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// One id per browser tab session; it carries no personal information.
const getSessionId = () => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = newSessionId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-storage";
  }
};

const takeBatch = () => {
  clearTimeout(timer);
  timer = null;
  const events = queue;
  queue = [];
  return events;
};

export const flush = async () => {
  const events = takeBatch();
  if (!events.length) {
    return;
  }

  try {
    await api.post("/events", { sessionId: getSessionId(), events });
  } catch {
    // Dropped on purpose: analytics is best-effort.
  }
};

// When the tab is being hidden or closed a normal request may be cancelled;
// `keepalive` lets the browser finish it in the background.
const flushOnHide = () => {
  const events = takeBatch();
  if (!events.length) {
    return;
  }

  try {
    const token = localStorage.getItem("foodex_token");
    fetch(`${api.defaults.baseURL}/events`, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId: getSessionId(), events }),
    }).catch(() => undefined);
  } catch {
    // Best-effort.
  }
};

export const track = (action, props = {}) => {
  queue.push({ action, ...props, clientTs: new Date().toISOString() });

  if (queue.length >= MAX_BATCH) {
    flush();
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_INTERVAL_MS);
  }
};

// Redux middleware: cart changes become clickstream events without each
// component that touches the cart having to remember to track them.
export const trackingMiddleware = () => (next) => (action) => {
  if (action.type === "cart/addToCart") {
    track("add_to_cart", {
      restaurantId: action.payload?.restaurantId,
      menuItemId: action.payload?.menuItemId,
    });
  } else if (action.type === "cart/removeFromCart") {
    track("remove_from_cart", { menuItemId: action.payload });
  }

  return next(action);
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushOnHide();
    }
  });
}
