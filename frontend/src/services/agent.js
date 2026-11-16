import api from "./api";

// Client for the AI ordering agent. planOrder streams the agent's steps
// (Server-Sent Events over a POST, read with fetch) and resolves with the
// final proposal.

const parseEvents = (buffer, onEvent) => {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop();
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice(6))
      .join("\n");
    if (data) {
      try {
        onEvent(JSON.parse(data));
      } catch {
        // Ignore a malformed event; the stream continues.
      }
    }
  }
  return rest;
};

export const planOrder = async ({ request, onStep, signal }) => {
  const token = localStorage.getItem("foodex_token");
  const response = await fetch(`${api.defaults.baseURL}/agent/plan?stream=1`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ request }),
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.details?.[0]?.msg || body.message || `The assistant is unavailable (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let proposal = null;
  let failure = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseEvents(buffer, (event) => {
      if (event.type === "step") onStep?.(event.step);
      if (event.type === "result") proposal = event.proposal;
      if (event.type === "error") failure = event.message;
    });
  }

  if (failure) throw new Error(failure);
  if (!proposal) throw new Error("The assistant stopped before finishing. Try again.");
  return proposal;
};

export const confirmProposal = async ({ proposalId, deliveryAddress, contactPhone }) => {
  const response = await api.post(`/agent/proposals/${proposalId}/confirm`, { deliveryAddress, contactPhone });
  return response.data.data;
};
