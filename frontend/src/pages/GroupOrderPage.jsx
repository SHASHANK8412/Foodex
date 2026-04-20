import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import api from "../services/api";
import { addToast } from "../redux/slices/uiSlice";
import { formatCurrency } from "../utils/format";

const GroupOrderPage = () => {
  const { inviteCode } = useParams();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [session, setSession] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState("");
  const [splitSummary, setSplitSummary] = useState([]);

  const code = String(inviteCode || "").toUpperCase();

  const loadSession = async () => {
    const response = await api.get(`/group-orders/${code}`);
    setSession(response.data?.data || null);
    return response.data?.data;
  };

  useEffect(() => {
    const bootstrap = async () => {
      if (!code) {
        return;
      }

      setLoading(true);
      try {
        await api.post("/group-orders/join", { inviteCode: code });
        const joined = await loadSession();

        if (joined?.restaurant?._id) {
          const restaurantResponse = await api.get(`/restaurants/${joined.restaurant._id}`);
          setMenu(restaurantResponse.data?.data?.menu || []);
        }
      } catch (error) {
        dispatch(addToast({ type: "error", message: error.message || "Unable to join group order" }));
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [code, dispatch]);

  const subtotal = useMemo(() => {
    return (session?.items || []).reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  }, [session?.items]);

  const memberCount = session?.members?.length || 0;
  const isHost = String(session?.host?._id || session?.host) === String(user?._id || user?.userId);

  const addItemToSession = async (menuItemId) => {
    setAddingItem(menuItemId);
    try {
      const response = await api.post(`/group-orders/${code}/items`, { menuItemId, quantity: 1 });
      setSession(response.data?.data || null);
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message || "Unable to add item" }));
    } finally {
      setAddingItem("");
    }
  };

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/group-order/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      dispatch(addToast({ type: "success", message: "Invite link copied" }));
    } catch (_error) {
      dispatch(addToast({ type: "info", message: link }));
    }
  };

  const closeSession = async () => {
    try {
      const response = await api.post(`/group-orders/${code}/close`);
      setSplitSummary(response.data?.data?.splitSummary || []);
      dispatch(addToast({ type: "success", message: "Group order closed" }));
      await loadSession().catch(() => null);
    } catch (error) {
      dispatch(addToast({ type: "error", message: error.message || "Unable to close group order" }));
    }
  };

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 dark:bg-slate-900">Loading group order...</p>;
  }

  if (!session) {
    return <p className="rounded-2xl bg-rose-50 p-6 text-sm font-semibold text-rose-700">Group order not found or inaccessible.</p>;
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Group order</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{session.restaurant?.name || "Foodex Kitchen"}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Invite code: <span className="font-bold text-slate-900 dark:text-slate-100">{session.inviteCode}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={copyInviteLink} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">
            Copy invite link
          </button>
          {isHost && session.status === "open" && (
            <button
              type="button"
              onClick={closeSession}
              className="rounded-full border border-rose-300 px-4 py-2 text-xs font-bold text-rose-700"
            >
              Close session
            </button>
          )}
          <Link to="/cart" className="rounded-full border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            Go to cart
          </Link>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Shared items</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{memberCount} members contributing</p>

          <div className="mt-4 space-y-2">
            {(session.items || []).map((item, index) => (
              <div key={`${item.menuItem}-${index}`} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-sm font-bold text-rose-600">{formatCurrency(item.lineTotal || 0)}</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Added by {item.addedByName || item.addedBy?.name || "Member"} • Qty {item.quantity}
                </p>
              </div>
            ))}
            {!session.items?.length && <p className="text-sm text-slate-500 dark:text-slate-300">No shared items yet.</p>}
          </div>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500">Group subtotal</p>
            <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</p>
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Add from menu</h2>
          <div className="mt-3 space-y-2">
            {menu.slice(0, 20).map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{formatCurrency(item.price || 0)}</p>
                </div>
                <button
                  type="button"
                  disabled={addingItem === item._id || session.status !== "open"}
                  onClick={() => addItemToSession(item._id)}
                  className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-60"
                >
                  {addingItem === item._id ? "Adding..." : "Add"}
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      {!!splitSummary.length && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-800/40 dark:bg-emerald-950/20">
          <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-300">Split payment summary</h3>
          <div className="mt-3 space-y-2">
            {splitSummary.map((entry) => (
              <div key={entry.userId} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{entry.name}</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(entry.amount)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">Use checkout to complete individual payments per member.</p>
        </section>
      )}
    </div>
  );
};

export default GroupOrderPage;
