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

  const savedAddress = user?.address || null;
  const hasSavedAddress = Boolean(savedAddress?.line1 && savedAddress?.city && savedAddress?.state && savedAddress?.postalCode);

  const [isEditingAddress, setIsEditingAddress] = useState(!hasSavedAddress);
  const [address, setAddress] = useState(() => ({
    line1: savedAddress?.line1 || "",
    city: savedAddress?.city || "",
    state: savedAddress?.state || "",
    postalCode: savedAddress?.postalCode || "",
  }));
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

        {hasSavedAddress && !isEditingAddress && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-500">Delivering to</p>
                <p className="mt-1 text-sm font-bold text-slate-900">{savedAddress.line1}</p>
                <p className="text-sm text-slate-600">
                  {savedAddress.city}, {savedAddress.state} {savedAddress.postalCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAddress(true)}
                className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
              >
                Change
              </button>
            </div>
          </div>
        )}

        {(!hasSavedAddress || isEditingAddress) && (
          <>
            <input
              required
              value={address.line1}
              onChange={(event) => setAddress((prev) => ({ ...prev, line1: event.target.value }))}
              placeholder="Address line"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                required
                value={address.city}
                onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="City"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
              <input
                required
                value={address.state}
                onChange={(event) => setAddress((prev) => ({ ...prev, state: event.target.value }))}
                placeholder="State"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
              <input
                required
                value={address.postalCode}
                onChange={(event) => setAddress((prev) => ({ ...prev, postalCode: event.target.value }))}
                placeholder="Postal code"
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-orange-400 focus:ring"
              />
            </div>
            {hasSavedAddress && (
              <button
                type="button"
                onClick={() => {
                  setAddress({
                    line1: savedAddress.line1 || "",
                    city: savedAddress.city || "",
                    state: savedAddress.state || "",
                    postalCode: savedAddress.postalCode || "",
                  });
                  setIsEditingAddress(false);
                }}
                className="inline-flex w-fit rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-800 hover:bg-slate-100"
              >
                Use saved address
              </button>
            )}
          </>
        )}

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
