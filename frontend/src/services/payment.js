const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export const loadRazorpaySdk = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// Razorpay Checkout blocks, one per method the customer can pick.
// UPI: QR code on desktop, the UPI app (intent) on mobile. The UPI Collect flow
// (typing a UPI ID and approving a request) is deprecated under NPCI rules from
// 28 Feb 2026, so it is hidden.
const BLOCKS = {
  upi: {
    name: "Pay with UPI",
    instruments: [{ method: "upi", flows: ["qr", "intent"], apps: ["google_pay", "phonepe", "paytm", "bhim"] }],
  },
  card: { name: "Pay with a card", instruments: [{ method: "card" }] },
  netbanking: { name: "Netbanking", instruments: [{ method: "netbanking" }] },
  wallet: { name: "Wallets", instruments: [{ method: "wallet" }] },
};

export const PAYMENT_METHODS = ["upi", "card", "netbanking", "wallet"];

// The chosen method's block first, the rest after it, so the customer can still switch.
export const buildCheckoutConfig = (method = "upi") => {
  const chosen = PAYMENT_METHODS.includes(method) ? method : "upi";
  const order = [chosen, ...PAYMENT_METHODS.filter((entry) => entry !== chosen)];
  return {
    display: {
      blocks: Object.fromEntries(order.map((entry) => [entry, BLOCKS[entry]])),
      sequence: order.map((entry) => `block.${entry}`),
      hide: [{ method: "upi", flows: ["collect"] }],
      preferences: { show_default_blocks: false },
    },
  };
};

export const openRazorpayCheckout = async ({
  key,
  amount,
  currency,
  orderId,
  customer,
  notes,
  method = "upi",
}) => {
  const loaded = await loadRazorpaySdk();
  if (!loaded || !window.Razorpay) {
    throw new Error("Razorpay SDK failed to load");
  }

  return new Promise((resolve, reject) => {
    const contact = customer?.phone || "";
    const email = customer?.email || "";
    const instance = new window.Razorpay({
      key,
      amount,
      currency,
      order_id: orderId,
      name: "Foodex",
      description: "Food order payment",
      image: "https://razorpay.com/assets/razorpay-logo.svg",
      prefill: {
        name: customer?.name || "",
        email,
        contact,
        // Razorpay only honours a prefilled method when contact and email are prefilled too.
        ...(contact && email ? { method } : {}),
      },
      notes,
      config: buildCheckoutConfig(method),
      handler: (response) => {
        resolve(response);
      },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      theme: {
        color: "#f43f5e",
      },
    });

    instance.on("payment.failed", (response) => {
      const reason = response?.error?.description || response?.error?.reason || "Payment failed";
      reject(new Error(reason));
    });

    instance.open();
  });
};
