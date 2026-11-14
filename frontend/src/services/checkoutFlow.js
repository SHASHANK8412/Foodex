import { verifyOrderPayment } from "../redux/slices/orderSlice";
import { openRazorpayCheckout } from "./payment";

// Takes payment for an order the server has created: Razorpay Checkout, or the
// mock flow when the API has no Razorpay keys. Shared by the checkout page and
// the AI ordering page. Resolves to { ok: true } or { ok: false, error }.
export const payForOrder = async ({ dispatch, order, payment, user, method = "upi", contactPhone }) => {
  if (payment.isMock) {
    const verified = await dispatch(
      verifyOrderPayment({
        orderId: order._id,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId: "mock_payment",
        razorpaySignature: "mock_signature",
        // Mock mode has no real payment to inspect, so it records the chosen method.
        paymentMethod: method,
      })
    );
    return verified.payload ? { ok: true } : { ok: false, error: "Payment verification failed in mock mode." };
  }

  try {
    const response = await openRazorpayCheckout({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      orderId: payment.razorpayOrderId,
      customer: { ...user, phone: contactPhone || user?.phone },
      notes: { appOrderId: order._id },
      method,
    });

    const verified = await dispatch(
      verifyOrderPayment({
        orderId: order._id,
        razorpayOrderId: response.razorpay_order_id,
        razorpayPaymentId: response.razorpay_payment_id,
        razorpaySignature: response.razorpay_signature,
      })
    );
    return verified.payload ? { ok: true } : { ok: false, error: "Payment verification failed." };
  } catch (error) {
    return { ok: false, error: error.message || "Payment was not completed." };
  }
};
