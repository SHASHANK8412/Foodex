import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Check, CircleAlert, Loader2, Sparkles, X } from "lucide-react";
import BillSummary from "../components/BillSummary";
import { addToCart, clearCart } from "../redux/slices/cartSlice";
import { addToast } from "../redux/slices/uiSlice";
import { confirmProposal, planOrder } from "../services/agent";
import { payForOrder } from "../services/checkoutFlow";
import { formatCurrency } from "../utils/format";
import PaymentMethodPicker from "../components/PaymentMethodPicker";
import { PAYMENT_METHOD_LABELS } from "../utils/paymentMethods";
import { isValidIndianMobile, loadCheckoutDetails, saveCheckoutDetails } from "../utils/checkoutDetails";

const EXAMPLES = [
  "Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes",
  "Italian dinner for me and my wife, she's vegetarian, around ₹700",
  "Quick South Indian breakfast for 4, ₹150 each",
  "Burgers for 2, no chicken, not too spicy",
];

const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const muted = "text-sm text-slate-600 dark:text-slate-400";

const FIELD_LABELS = {
  budgetTotal: "Budget",
  partySize: "People",
  maxDeliveryMinutes: "Delivery time",
  diet: "Diet",
  exclude: "Avoid",
};

const specChips = (spec) =>
  [
    `${spec.partySize} ${spec.partySize === 1 ? "person" : "people"}`,
    spec.diet === "veg" && "Vegetarian",
    ...spec.cuisines,
    spec.spice === "hot" && "Spicy",
    spec.spice === "no_hot" && "Not spicy",
    spec.budgetTotal && `Under ₹${Math.round(spec.budgetTotal)}`,
    spec.maxDeliveryMinutes && `Within ${spec.maxDeliveryMinutes} min`,
    ...spec.include.map((word) => `With ${word}`),
    ...spec.exclude.map((word) => `No ${word}`),
  ].filter(Boolean);

const StepIcon = ({ step }) => {
  if (step.kind === "proposal" && !step.passed) return <X size={16} className="text-rose-600" aria-label="rejected" />;
  if (step.kind === "infeasible") return <CircleAlert size={16} className="text-amber-600" aria-label="not possible" />;
  return <Check size={16} className="text-emerald-600" aria-label="done" />;
};

const Checklist = ({ checks }) => (
  <ul className="space-y-1.5">
    {checks.map((entry) => (
      <li key={entry.id} className="flex items-start gap-2 text-sm">
        {entry.passed ? (
          <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-label="passed" />
        ) : (
          <X size={16} className="mt-0.5 shrink-0 text-rose-600" aria-label="failed" />
        )}
        <span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.label}</span>
          <span className="text-slate-600 dark:text-slate-400"> · {entry.detail}</span>
        </span>
      </li>
    ))}
  </ul>
);

const AddressForm = ({ value, onChange, onSubmit, busy, total }) => (
  <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Delivery address</p>
    {[
      ["line1", "Address line"],
      ["city", "City"],
      ["state", "State"],
      ["postalCode", "PIN code"],
      ["phone", "Mobile number"],
    ].map(([field, label]) => (
      <label key={field} className="block">
        <span className="sr-only">{label}</span>
        <input
          required
          value={value[field]}
          onChange={(event) => onChange({ ...value, [field]: event.target.value })}
          placeholder={label}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
    ))}
    {value.phone && !isValidIndianMobile(value.phone) && (
      <p className="text-xs font-semibold text-rose-700">Enter a 10-digit mobile number.</p>
    )}
    <PaymentMethodPicker value={value.method} onChange={(method) => onChange({ ...value, method })} compact />
    <button
      type="submit"
      disabled={busy || !isValidIndianMobile(value.phone)}
      className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60"
    >
      {busy ? "Opening payment…" : `Pay ${formatCurrency(total)} with ${PAYMENT_METHOD_LABELS[value.method] || "Razorpay"}`}
    </button>
  </form>
);

const AiOrderPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [request, setRequest] = useState("");
  const [steps, setSteps] = useState([]);
  const [planning, setPlanning] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [address, setAddress] = useState(() => loadCheckoutDetails(user));
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const abortRef = useRef(null);

  const plan = async (text) => {
    const value = String(text ?? request).trim();
    if (value.length < 3 || planning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRequest(value);
    setPlanning(true);
    setSteps([]);
    setProposal(null);
    setError("");
    setShowAddress(false);
    setConfirmError(null);

    try {
      const result = await planOrder({
        request: value,
        signal: controller.signal,
        onStep: (step) => setSteps((previous) => [...previous, step]),
      });
      setProposal(result);
    } catch (planError) {
      if (planError.name !== "AbortError") setError(planError.message);
    } finally {
      setPlanning(false);
    }
  };

  const editInCart = () => {
    dispatch(clearCart());
    proposal.items.forEach((line) =>
      dispatch(
        addToCart({
          menuItemId: line.menuItemId,
          restaurantId: proposal.restaurant.id,
          name: line.name,
          price: line.price,
          quantity: line.quantity,
        })
      )
    );
    navigate("/cart");
  };

  // The only place an agent proposal turns into an order, and only on the
  // customer's click. The server re-checks the cart before creating the order.
  const confirmAndPay = async (event) => {
    event.preventDefault();
    setConfirming(true);
    setConfirmError(null);
    try {
      saveCheckoutDetails(address);
      const { line1, city, state, postalCode, phone, method } = address;
      const { order, payment } = await confirmProposal({
        proposalId: proposal.id,
        deliveryAddress: { line1, city, state, postalCode },
        contactPhone: phone,
      });
      const paid = await payForOrder({ dispatch, order, payment, user, method, contactPhone: phone });
      if (!paid.ok) {
        setConfirmError({ message: `Your order was created but not paid: ${paid.error}`, details: [] });
        return;
      }
      dispatch(addToast({ type: "success", message: "Order placed" }));
      navigate(`/order-confirmation?orderId=${order._id}`);
    } catch (confirmFailure) {
      setConfirmError({ message: confirmFailure.message, details: confirmFailure.details || [] });
    } finally {
      setConfirming(false);
    }
  };

  const proposed = proposal?.status === "proposed";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
          <Sparkles size={14} aria-hidden="true" /> AI ordering assistant
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Tell us what you&apos;re craving</h1>
        <p className={`mt-1 ${muted}`}>
          The assistant reads real menus, prices and delivery times, builds a cart, and checks it against your request.
          Nothing is ordered until you confirm.
        </p>
      </header>

      <form
        className={card}
        onSubmit={(event) => {
          event.preventDefault();
          plan();
        }}
      >
        <label htmlFor="agent-request" className="sr-only">
          What would you like to order?
        </label>
        <textarea
          id="agent-request"
          rows={3}
          maxLength={500}
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              plan();
            }
          }}
          placeholder="e.g. Something spicy and veg for 3 people, under ₹600, delivered in 30 minutes"
          className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-rose-300 focus:ring dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                disabled={planning}
                onClick={() => plan(example)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={planning || request.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {planning ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
            {planning ? "Planning…" : "Build my cart"}
          </button>
        </div>
      </form>

      {(planning || steps.length > 0) && (
        <section className={card} aria-live="polite">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">What the assistant did</h2>
          <ol className="mt-3 space-y-2">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="mt-0.5">
                  <StepIcon step={step} />
                </span>
                <span>
                  {step.summary}
                  {step.corrections?.length > 0 && (
                    <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                      Corrected the model&apos;s reading:{" "}
                      {step.corrections.map((entry) => `${FIELD_LABELS[entry.field] || entry.field} → ${JSON.stringify(entry.to)}`).join(", ")}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {planning && (
              <li className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                {steps.length ? "Working on it…" : "Reading your request…"}
              </li>
            )}
          </ol>
        </section>
      )}

      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">{error}</p>}

      {proposal && (
        <section className={card}>
          <div className="flex flex-wrap gap-2">
            {specChips(proposal.spec).map((chip) => (
              <span key={chip} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {chip}
              </span>
            ))}
          </div>

          {proposed ? (
            <div className="mt-5 grid gap-6 md:grid-cols-[1fr_300px]">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">{proposal.restaurant.name}</h2>
                <p className={muted}>
                  About {proposal.etaMinutes} min · {proposal.summary}
                </p>
                <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {proposal.items.map((line) => (
                    <li key={line.menuItemId} className="flex justify-between gap-3 py-2 text-sm">
                      <span className="text-slate-900 dark:text-slate-100">
                        {line.quantity} × {line.name}
                      </span>
                      <span className="tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(line.price * line.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Checked against your request</h3>
                <div className="mt-2">
                  <Checklist checks={proposal.checks} />
                </div>
              </div>

              <aside>
                <BillSummary quote={proposal.quote} loading={false} error="" />
                {!showAddress ? (
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowAddress(true)}
                      className="w-full rounded-full bg-rose-500 px-5 py-3 text-sm font-bold text-white hover:bg-rose-600"
                    >
                      Confirm this cart
                    </button>
                    <button
                      type="button"
                      onClick={editInCart}
                      className="w-full rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Edit in cart
                    </button>
                  </div>
                ) : (
                  <AddressForm value={address} onChange={setAddress} onSubmit={confirmAndPay} busy={confirming} total={proposal.quote.totalAmount} />
                )}
                {confirmError && (
                  <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950 dark:text-rose-200" role="alert">
                    <p className="font-semibold">{confirmError.message}</p>
                    {confirmError.details?.length > 0 && (
                      <ul className="mt-1 list-disc pl-5">
                        {confirmError.details.map((entry, index) => (
                          <li key={index}>{entry.label ? `${entry.label}: ${entry.detail}` : entry.msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {proposal.status === "declined" ? "That can't be done right now" : "The assistant couldn't find a cart that fits"}
              </h2>
              {proposal.reason && <p className="text-sm text-slate-700 dark:text-slate-300">{proposal.reason}</p>}
              {proposal.closestOption && <p className={muted}>Closest option: {proposal.closestOption}</p>}
              {proposal.checks?.length > 0 && <Checklist checks={proposal.checks} />}
              <p className={muted}>Try a higher budget, a longer delivery time or fewer restrictions.</p>
            </div>
          )}

          <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Planned by {proposal.engine === "rules" ? "the rule-based planner" : `${proposal.models.join(", ") || proposal.engine}`} in{" "}
            {(proposal.latencyMs / 1000).toFixed(1)}s · {proposal.proposals} {proposal.proposals === 1 ? "attempt" : "attempts"}
            {proposal.usage?.modelCalls ? ` · ${proposal.usage.modelCalls} model calls` : ""}
          </p>
        </section>
      )}
    </div>
  );
};

export default AiOrderPage;
