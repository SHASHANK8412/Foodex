import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addUserChatMessage,
  appendAssistantChunk,
  completeAssistantMessage,
  startAssistantMessage,
} from "../redux/slices/aiSlice";
import { addToCart } from "../redux/slices/cartSlice";
import { addToast } from "../redux/slices/uiSlice";
import api from "../services/api";

const FloatingAIChatWidget = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const { chatMessages, chatLoading } = useSelector((state) => state.ai);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const canSend = useMemo(() => Boolean(token && message.trim() && !chatLoading), [token, message, chatLoading]);

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }

    const userMessage = message.trim();
    setMessage("");
    dispatch(addUserChatMessage(userMessage));
    dispatch(startAssistantMessage());

    try {
      const response = await api.post("/ai/chat", {
        message: userMessage,
      });

      const payload = response.data?.data;
      dispatch(appendAssistantChunk(payload?.reply || "No response from AI."));

      const actions = payload?.actions || [];
      actions.forEach((action) => {
        if (action.type === "add_to_cart" && action.payload) {
          dispatch(addToCart(action.payload));
          dispatch(
            addToast({
              type: "success",
              message: `${action.payload.name} added to cart`,
            })
          );
        }
      });
    } catch (error) {
      dispatch(appendAssistantChunk(error.message || "Unable to get AI response."));
    } finally {
      dispatch(completeAssistantMessage());
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-[95] rounded-full bg-rose-500 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-rose-500/30"
      >
        AI Order
      </button>

      {open && (
        <section className="fixed bottom-24 right-6 z-[95] flex h-[420px] w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100">Foodex AI Concierge</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Try: order me a spicy pizza under Rs.300</p>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-4">
            {!chatMessages.length && (
              <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                I can search dishes semantically, suggest combos, and add items to your cart.
              </p>
            )}

            {chatMessages.map((msg, index) => (
              <div
                key={index}
                className={
                  "max-w-[86%] rounded-2xl px-3 py-2 text-sm " +
                  (msg.role === "user"
                    ? "ml-auto bg-slate-900 text-white"
                    : "bg-rose-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200")
                }
              >
                {msg.content}
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={token ? "Ask AI to order food" : "Login to use AI ordering"}
              className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              disabled={!token || chatLoading}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
};

export default FloatingAIChatWidget;
