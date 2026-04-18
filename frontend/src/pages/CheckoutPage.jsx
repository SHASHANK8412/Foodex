import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { clearCart } from "../redux/slices/cartSlice";
import { createOrder, verifyOrderPayment } from "../redux/slices/orderSlice";
import { fetchDeliveryEstimate } from "../redux/slices/analyticsSlice";
import { openRazorpayCheckout } from "../services/payment";
import { formatCurrency } from "../utils/format";

const CheckoutPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items } = useSelector((state) => state.cart);
  const { user } = useSelector((state) => state.auth);
  const { loading, error } = useSelector((state) => state.orders);
  const { deliveryEstimate } = useSelector((state) => state.analytics);

  const [address, setAddress] = useState({ line1: "", city: "", state: "", postalCode: "" });
  const [paymentError, setPaymentError] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = subtotal + subtotal * 0.05 + (items.length ? 40 : 0);

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const restaurantId = items[0].restaurantId;
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    dispatch(
      fetchDeliveryEstimate({
        restaurantId,
        itemCount,
        distanceKm: 4,
        hourOfDay: new Date().getHours(),
      })
    );
  }, [dispatch, items]);

  const handlePlaceOrder = async (event) => {
    event.preventDefault();
    setPaymentError("");

    if (!items.length) {
      return;
    }

    const restaurantId = items[0].restaurantId;

    const orderPayload = {
      restaurantId,
      items: items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
      deliveryAddress: address,
    };

    const result = await dispatch(createOrder(orderPayload));
    if (!result.payload?.order) {
      return;
    }

    const order = result.payload.order;
    const payment = result.payload.payment;

    if (payment.isMock) {
      const verifyAction = await dispatch(
        verifyOrderPayment({
          orderId: order._id,
          razorpayOrderId: payment.razorpayOrderId,
          razorpayPaymentId: "mock_payment",
          razorpaySignature: "mock_signature",
        })
      );

      if (!verifyAction.payload) {
        setPaymentError("Payment verification failed in mock mode.");
        return;
      }
    } else {
      try {
        const response = await openRazorpayCheckout({
          key: payment.keyId,
          amount: payment.amount,
          currency: payment.currency,
          orderId: payment.razorpayOrderId,
          customer: user,
          notes: {
            appOrderId: order._id,
          },
        });

        const verifyAction = await dispatch(
          verifyOrderPayment({
            orderId: order._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })
        );

        if (!verifyAction.payload) {
          setPaymentError("Payment verification failed.");
          return;
        }
      } catch (checkoutError) {
        setPaymentError(checkoutError.message || "Payment was not completed.");
        return;
      }
    }

    dispatch(clearCart());
    navigate("/orders/track?orderId=" + order._id);
  };

  if (!items.length) {
    return <p className="rounded-2xl bg-white p-6">No items in cart.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={handlePlaceOrder} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Checkout</h1>
        <p className="text-sm text-slate-600">Enter delivery details and place your order.</p>

        <input
          required
          value={address.line1}
          onChange={(event) => setAddress((prev) => ({ ...prev, line1: event.target.value }))}
          placeholder="Address line"
          className="w-full rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-600 outline-none ring-orange-400 focus:ring"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            required
            value={address.city}
            onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
            placeholder="City"
            className="rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-600 outline-none ring-orange-400 focus:ring"
          />
          <input
            required
            value={address.state}
            onChange={(event) => setAddress((prev) => ({ ...prev, state: event.target.value }))}
            placeholder="State"
            className="rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-600 outline-none ring-orange-400 focus:ring"
          />
          <input
            required
            value={address.postalCode}
            onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
            placeholder="Postal code"
            className="rounded-xl border border-slate-400 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-600 outline-none ring-orange-400 focus:ring"
          />
        </div>

        {(error || paymentError) && (
          <p className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{paymentError || error}</p>
        )}

        <button
          disabled={loading}
          type="submit"
          className="rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Processing..." : "Place order"}
        </button>
      </form>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Payable amount</h2>
        <p className="mt-4 text-3xl font-black text-slate-900">{formatCurrency(total)}</p>
        <p className="mt-1 text-xs text-slate-500">Includes tax and delivery fee.</p>
        {deliveryEstimate?.estimatedMinutes && (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
            Estimated delivery time: {deliveryEstimate.estimatedMinutes} mins
          </p>
        )}
      </aside>
    </div>
  );
};

export default CheckoutPage;
