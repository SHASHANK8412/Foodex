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

export const openRazorpayCheckout = async ({
  key,
  amount,
  currency,
  orderId,
  customer,
  notes,
}) => {
  const loaded = await loadRazorpaySdk();
  if (!loaded || !window.Razorpay) {
    throw new Error("Razorpay SDK failed to load");
  }

  return new Promise((resolve, reject) => {
    const instance = new window.Razorpay({
      key,
      amount,
      currency,
      order_id: orderId,
      name: "Foodex",
      description: "Food order payment",
      prefill: {
        name: customer?.name || "",
        email: customer?.email || "",
        contact: customer?.phone || "",
      },
      notes,
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
