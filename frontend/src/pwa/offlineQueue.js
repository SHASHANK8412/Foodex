const STORAGE_KEY = "foodex_offline_cart_queue";

export const enqueueCartMutation = (payload) => {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  list.push({ payload, ts: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
};

export const flushCartQueue = async (executor) => {
  const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!list.length) return;

  const remaining = [];
  for (const item of list) {
    try {
      await executor(item.payload);
    } catch (_error) {
      remaining.push(item);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
};
