const OpenAI = require("openai");

// LLM providers for the ordering agent, behind one small interface:
//
//   const session = provider.createSession({ system, tools });
//   const turn = await session.send({ text })                       // a user message
//   const turn = await session.send({ toolResults: [{ id, name, output }] })
//   turn = { toolCalls: [{ id, name, args }], text, usage: { inputTokens, outputTokens }, model }
//
// Each session keeps the provider's own message history, so provider-specific
// fields (Gemini's thought signatures, OpenAI tool_call ids) round-trip intact.

const REQUEST_TIMEOUT_MS = 45000;
const RETRY_DELAYS_MS = [1500, 4000];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Models often send null for optional parameters they do not use. Providers
// that validate tool calls (Groq) reject that unless the schema allows it, so
// every optional property is declared nullable, in each provider's dialect.
const withNullableOptionals = (schema, dialect) => {
  if (!schema || typeof schema !== "object") return schema;
  const copy = { ...schema };
  if (copy.items) copy.items = withNullableOptionals(copy.items, dialect);
  if (copy.properties) {
    const required = new Set(copy.required || []);
    copy.properties = Object.fromEntries(
      Object.entries(copy.properties).map(([key, value]) => {
        const inner = withNullableOptionals(value, dialect);
        if (required.has(key)) return [key, inner];
        if (dialect === "gemini") return [key, { ...inner, nullable: true }];
        const { enum: allowed, ...rest } = inner;
        return [
          key,
          {
            ...rest,
            type: [...new Set([].concat(inner.type || []).concat("null"))],
            ...(allowed ? { enum: [...allowed, null] } : {}),
          },
        ];
      })
    );
  }
  return copy;
};

const isToolValidationError = (error) => error?.status === 400 && /tool call validation|did not match schema|failed_generation/i.test(error.message || "");

class ProviderError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------- Gemini

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const toGeminiTools = (tools) => [
  {
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: withNullableOptionals(tool.parameters, "gemini"),
    })),
  },
];

const createGeminiProvider = ({ apiKey, models }) => ({
  name: "gemini",
  models,
  createSession({ system, tools }) {
    const contents = [];
    let modelIndex = 0;

    const call = async () => {
      let lastError;
      while (modelIndex < models.length) {
        const model = models[modelIndex];
        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
          try {
            const response = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: system }] },
                contents,
                tools: toGeminiTools(tools),
                toolConfig: { functionCallingConfig: { mode: "AUTO" } },
                generationConfig: { temperature: 0.2 },
              }),
            });
            const body = await response.json().catch(() => ({}));
            if (response.ok) {
              return { model, body };
            }
            lastError = new ProviderError(body.error?.message || `Gemini returned ${response.status}`, response.status);
            if (!RETRYABLE.has(response.status)) break; // e.g. 404: this model is unavailable, try the next
          } catch (error) {
            lastError = new ProviderError(error.name === "AbortError" ? "Gemini request timed out" : error.message, 0);
          } finally {
            clearTimeout(timer);
          }
          if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
        }
        // This model kept failing: later turns go straight to the next one.
        modelIndex += 1;
      }
      throw lastError || new ProviderError("No Gemini model available", 0);
    };

    return {
      async send({ text, toolResults }) {
        if (text) {
          contents.push({ role: "user", parts: [{ text }] });
        } else {
          contents.push({
            role: "user",
            parts: toolResults.map((result) => ({
              functionResponse: { name: result.name, ...(result.id ? { id: result.id } : {}), response: { output: result.output } },
            })),
          });
        }

        const { model, body } = await call();
        const content = body.candidates?.[0]?.content || { role: "model", parts: [] };
        contents.push({ role: "model", parts: content.parts || [] });

        const parts = content.parts || [];
        return {
          model,
          text: parts.filter((part) => part.text && !part.thought).map((part) => part.text).join("\n").trim(),
          toolCalls: parts
            .filter((part) => part.functionCall)
            .map((part, index) => ({
              id: part.functionCall.id || `call_${contents.length}_${index}`,
              name: part.functionCall.name,
              args: part.functionCall.args || {},
            })),
          usage: {
            inputTokens: body.usageMetadata?.promptTokenCount || 0,
            outputTokens: (body.usageMetadata?.candidatesTokenCount || 0) + (body.usageMetadata?.thoughtsTokenCount || 0),
          },
        };
      },
    };
  },
});

// ------------------------------------------------- OpenAI-compatible (Groq, OpenAI)

const createOpenAiCompatibleProvider = ({ name, apiKey, baseURL, models }) => {
  const client = new OpenAI({ apiKey, baseURL, timeout: REQUEST_TIMEOUT_MS, maxRetries: RETRY_DELAYS_MS.length });

  return {
    name,
    models,
    createSession({ system, tools }) {
      const messages = [{ role: "system", content: system }];
      const toolDefs = tools.map((tool) => ({
        type: "function",
        function: { ...tool, parameters: withNullableOptionals(tool.parameters, "openai") },
      }));
      let modelIndex = 0;

      return {
        async send({ text, toolResults }) {
          if (text) {
            messages.push({ role: "user", content: text });
          } else {
            toolResults.forEach((result) =>
              messages.push({ role: "tool", tool_call_id: result.id, content: JSON.stringify(result.output) })
            );
          }

          let completion;
          let lastError;
          let validationRetries = 0;
          while (!completion && modelIndex < models.length) {
            try {
              completion = await client.chat.completions.create({
                model: models[modelIndex],
                messages,
                tools: toolDefs,
                tool_choice: "auto",
                temperature: 0.2,
              });
            } catch (error) {
              lastError = new ProviderError(error.message, error.status || 0);
              // A malformed tool call is a sampling slip: ask the same model again.
              if (isToolValidationError(lastError) && validationRetries < 2) {
                validationRetries += 1;
                continue;
              }
              validationRetries = 0;
              modelIndex += 1;
            }
          }
          if (!completion) throw lastError;

          const message = completion.choices?.[0]?.message || { role: "assistant", content: "" };
          messages.push(message);

          return {
            model: completion.model || models[modelIndex],
            text: (message.content || "").trim(),
            toolCalls: (message.tool_calls || []).map((call) => {
              let args = {};
              try {
                args = JSON.parse(call.function.arguments || "{}");
              } catch {
                args = { __invalidJson: call.function.arguments };
              }
              return { id: call.id, name: call.function.name, args };
            }),
            usage: {
              inputTokens: completion.usage?.prompt_tokens || 0,
              outputTokens: completion.usage?.completion_tokens || 0,
            },
          };
        },
      };
    },
  };
};

const splitModels = (value, fallback) =>
  String(value || fallback)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

/**
 * The provider for the agent. AGENT_LLM_PROVIDER picks one explicitly
 * (groq | gemini | openai | rules); "auto" (the default) uses the first one
 * with an API key, in that order. Returns null for the rule-based agent.
 */
const resolveProvider = (override = {}) => {
  const choice = (override.provider || process.env.AGENT_LLM_PROVIDER || "auto").toLowerCase();
  const models = override.models;

  const groq = () =>
    process.env.GROQ_API_KEY &&
    createOpenAiCompatibleProvider({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      models: models || splitModels(process.env.AGENT_GROQ_MODELS, "openai/gpt-oss-120b,qwen/qwen3.8-27b"),
    });
  const gemini = () =>
    process.env.GOOGLE_GEMINI_API_KEY &&
    createGeminiProvider({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
      models: models || splitModels(process.env.AGENT_GEMINI_MODELS, "gemini-3.5-flash-lite,gemini-3.8-flash"),
    });
  const openai = () =>
    process.env.OPENAI_API_KEY &&
    createOpenAiCompatibleProvider({
      name: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      models: models || splitModels(process.env.AGENT_OPENAI_MODELS, "gpt-4o-mini"),
    });

  if (choice === "rules") return null;
  if (choice === "groq") return groq() || null;
  if (choice === "gemini") return gemini() || null;
  if (choice === "openai") return openai() || null;
  return groq() || gemini() || openai() || null;
};

/**
 * Every configured provider, in preference order, for failover: if one fails
 * (expired key, quota, outage) the next is tried before the rule-based planner.
 * An explicit AGENT_LLM_PROVIDER pins a single provider.
 */
const resolveProviders = () => {
  const choice = (process.env.AGENT_LLM_PROVIDER || "auto").toLowerCase();
  if (choice !== "auto") {
    const pinned = resolveProvider({ provider: choice });
    return pinned ? [pinned] : [];
  }
  return ["groq", "gemini", "openai"].map((name) => resolveProvider({ provider: name })).filter(Boolean);
};

// A rejected key will not start working on its own, so a provider that fails
// authentication is skipped for a while instead of costing every request a
// failed call.
const AUTH_FAILURE_COOLDOWN_MS = 30 * 60 * 1000;
const authFailures = new Map();

const isAuthError = (error) =>
  [401, 403].includes(error?.status) || /invalid api key|api key (not valid|expired)|expired_api_key|permission denied/i.test(error?.message || "");

const markAuthFailure = (name) => authFailures.set(name, Date.now());

const isCoolingDown = (name) => {
  const at = authFailures.get(name);
  if (!at) return false;
  if (Date.now() - at > AUTH_FAILURE_COOLDOWN_MS) {
    authFailures.delete(name);
    return false;
  }
  return true;
};

const resetAuthFailures = () => authFailures.clear();

module.exports = {
  resolveProviders,
  isAuthError,
  markAuthFailure,
  isCoolingDown,
  resetAuthFailures,
  resolveProvider, createGeminiProvider, createOpenAiCompatibleProvider, ProviderError, withNullableOptionals };
