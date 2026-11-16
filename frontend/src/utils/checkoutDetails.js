// The delivery address, phone and payment method from the last checkout, kept
// in this browser so returning customers don't retype them.
const STORAGE_KEY = "foodex_checkout_details";

const DEFAULTS = { line1: "", city: "Bengaluru", state: "Karnataka", postalCode: "", phone: "", method: "upi" };

export const normalizeIndianMobile = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .replace(/^(?:91|0)(?=\d{10}$)/, "");

export const isValidIndianMobile = (value) => /^[6-9]\d{9}$/.test(normalizeIndianMobile(value));

export const loadCheckoutDetails = (user) => {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    saved = {};
  }
  return { ...DEFAULTS, phone: user?.phone || "", ...saved };
};

export const saveCheckoutDetails = (details) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch {
    // Storage blocked: details are simply not remembered.
  }
};
