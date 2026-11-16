import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";
import api from "../services/api";
import { connectSocket } from "../services/socket";
import { addToast } from "../redux/slices/uiSlice";
import { formatCurrency, formatDateTime, formatNumber } from "../utils/format";
import {
  DemandHeatmap,
  FunnelBars,
  OrdersPerMinuteChart,
  RankedBars,
  ThroughputChart,
} from "../components/pipeline/PipelineCharts";

const STATUS_POLL_MS = 10000;
const REALTIME_POLL_MS = 5000;
const SPARK_ENGINE = "spark-structured-streaming";

const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const heading = "text-lg font-bold text-slate-900 dark:text-slate-100";
const muted = "text-sm text-slate-600 dark:text-slate-400";

const BADGES = {
  ok: { Icon: CheckCircle2, className: "text-emerald-700 dark:text-emerald-400" },
  fallback: { Icon: AlertTriangle, className: "text-amber-700 dark:text-amber-400" },
  idle: { Icon: CircleDashed, className: "text-slate-500 dark:text-slate-400" },
};

const StatusBadge = ({ tone, children }) => {
  const { Icon, className } = BADGES[tone] || BADGES.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      <Icon size={14} aria-hidden="true" />
      {children}
    </span>
  );
};

const StageCard = ({ step, title, tone, status, children }) => (
  <article className={card}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Stage {step}</p>
    <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
    <div className="mt-2">
      <StatusBadge tone={tone}>{status}</StatusBadge>
    </div>
    <div className={`mt-3 space-y-1 ${muted}`}>{children}</div>
  </article>
);

const StatTile = ({ label, value, hint }) => (
  <div className={card}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-3xl font-black tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
  </div>
);

const Command = ({ children }) => (
  <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-100 dark:bg-slate-950">
    <code>{children}</code>
  </pre>
);

const dash = (value) => (value === null || value === undefined ? "—" : formatNumber(value));

const TopicsTable = ({ kafka, events }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <tr>
          <th className="py-2 pr-3 font-semibold">Topic</th>
          <th className="px-3 py-2 text-right font-semibold">Partitions</th>
          <th className="px-3 py-2 text-right font-semibold">On broker</th>
          <th className="px-3 py-2 text-right font-semibold">Published</th>
          <th className="px-3 py-2 text-right font-semibold">Handled</th>
          <th className="px-3 py-2 text-right font-semibold">Dead-lettered</th>
          <th className="py-2 pl-3 text-right font-semibold">Consumer lag</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-slate-700 dark:text-slate-200">
        {kafka.topics.map((topic) => {
          const stats = events.topics[topic.topic] || {};
          return (
            <tr key={topic.topic} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2 pr-3 font-mono text-xs">{topic.topic}</td>
              <td className="px-3 py-2 text-right">{dash(topic.partitions)}</td>
              <td className="px-3 py-2 text-right">{dash(topic.messages)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(stats.produced)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(stats.consumed)}</td>
              <td className="px-3 py-2 text-right">{formatNumber(stats.deadLettered)}</td>
              <td className="py-2 pl-3 text-right">{dash(topic.consumerLag)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
      Published, Handled and Dead-lettered count this API process since it started. Partitions, On broker and
      Consumer lag come from the Kafka broker and show “—” while Kafka is not connected.
    </p>
  </div>
);

const SegmentsTable = ({ segments }) => {
  const max = Math.max(...segments.map((segment) => Number(segment.customers) || 0), 1);

  return (
    <div className="viz-root overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="py-2 pr-3 font-semibold">Segment</th>
            <th className="px-3 py-2 font-semibold">Customers</th>
            <th className="px-3 py-2 text-right font-semibold">Avg orders</th>
            <th className="px-3 py-2 text-right font-semibold">Avg spend</th>
            <th className="py-2 pl-3 text-right font-semibold">Days since last order</th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-slate-700 dark:text-slate-200">
          {segments.map((segment) => (
            <tr key={segment.segment} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">{segment.segment}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-28 rounded-r bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-r"
                      style={{ width: `${(segment.customers / max) * 100}%`, background: "var(--viz-series)" }}
                    />
                  </div>
                  <span>
                    {formatNumber(segment.customers)} ({Math.round((segment.share || 0) * 100)}%)
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">{segment.avgOrders}</td>
              <td className="px-3 py-2 text-right">{formatCurrency(segment.avgSpend)}</td>
              <td className="py-2 pl-3 text-right">{segment.avgRecencyDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BasketRulesTable = ({ rules }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[480px] text-left text-sm">
      <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <tr>
          <th className="py-2 pr-3 font-semibold">Customers who order</th>
          <th className="px-3 py-2 font-semibold">also order</th>
          <th className="px-3 py-2 text-right font-semibold">Confidence</th>
          <th className="py-2 pl-3 text-right font-semibold">Lift</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-slate-700 dark:text-slate-200">
        {rules.map((rule) => {
          const antecedent = (rule.antecedent || []).join(" + ");
          const consequent = (rule.consequent || []).join(" + ");
          return (
            <tr key={`${antecedent}>${consequent}`} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-2 pr-3">{antecedent}</td>
              <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{consequent}</td>
              <td className="px-3 py-2 text-right">{Math.round((rule.confidence || 0) * 100)}%</td>
              <td className="py-2 pl-3 text-right">{Number(rule.lift || 0).toFixed(1)}×</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const BatchInsights = ({ insights }) => {
  if (!insights?.available) {
    return (
      <div className={card}>
        <h3 className={heading}>No Spark batch output yet</h3>
        <p className={`mt-1 ${muted}`}>
          The batch job has not written any datasets to the API&apos;s analytics output folder. Recommendations,
          demand and delivery estimates are served from MongoDB fallbacks until it runs. From the project root:
        </p>
        <div className="mt-3 space-y-2">
          <Command>cd backend &amp;&amp; npm run analytics:export</Command>
          <Command>python backend/analytics/generate_orders.py --orders 200000 --catalog backend/analytics/data/catalog.json --out backend/analytics/data/synthetic</Command>
          <Command>docker compose --profile batch up spark-batch</Command>
        </div>
      </div>
    );
  }

  const { manifest, segments, basketRules, topItems, restaurantKpis, heatmap, etaModel } = insights;
  const counts = manifest?.counts || {};
  const metrics = manifest?.metrics || {};

  return (
    <div className="space-y-6">
      {manifest ? (
        <p className={muted}>
          Last run {formatDateTime(manifest.generatedAt)} on Spark {manifest.sparkVersion} ({manifest.master}), dataset
          label <span className="font-semibold text-slate-900 dark:text-slate-100">{manifest.datasetLabel}</span>, in{" "}
          {manifest.durationSeconds}s.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Orders processed" value={formatNumber(counts.orders)} hint="after cleaning and de-duplication" />
        <StatTile label="Customers" value={formatNumber(counts.customers)} />
        <StatTile label="Restaurants" value={formatNumber(counts.restaurants)} />
        <StatTile
          label="Delivery ETA error"
          value={etaModel ? `${Number(etaModel.rmse).toFixed(1)} min` : "—"}
          hint={
            etaModel
              ? `RMSE on ${formatNumber(etaModel.testRows)} held-out orders, R² ${Number(etaModel.r2).toFixed(2)}`
              : "not enough delivered orders to train"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card}>
          <h3 className={heading}>Customer segments</h3>
          <p className={`mb-3 mt-1 ${muted}`}>
            K-Means on recency, frequency and spend
            {metrics.segments ? ` (k = ${metrics.segments.k}, silhouette ${metrics.segments.silhouette})` : ""}.
          </p>
          {segments.length ? <SegmentsTable segments={segments} /> : <p className={muted}>Not enough customers to cluster.</p>}
        </section>

        <section className={card}>
          <h3 className={heading}>Ordered together</h3>
          <p className={`mb-3 mt-1 ${muted}`}>
            FP-Growth association rules, strongest first. Lift above 1 means the pair is ordered together more often
            than chance.
          </p>
          {basketRules.length ? (
            <BasketRulesTable rules={basketRules.slice(0, 8)} />
          ) : (
            <p className={muted}>No rules above the support threshold.</p>
          )}
        </section>

        <section className={card}>
          <h3 className={heading}>Best-selling dishes</h3>
          <p className={`mb-3 mt-1 ${muted}`}>Units sold across all processed orders.</p>
          <RankedBars rows={topItems.slice(0, 8)} labelKey="itemName" valueKey="quantity" emptyText="No items." />
        </section>

        <section className={card}>
          <h3 className={heading}>Top restaurants by order value</h3>
          <p className={`mb-3 mt-1 ${muted}`}>Total order value, with order count.</p>
          <RankedBars
            rows={restaurantKpis.slice(0, 8)}
            labelKey="restaurantName"
            valueKey="revenue"
            formatValue={formatCurrency}
            detail={(row) => `${formatNumber(row.orders)} orders`}
            emptyText="No restaurants."
          />
        </section>
      </div>

      {heatmap.length ? (
        <section className={card}>
          <h3 className={heading}>When customers order</h3>
          <p className={`mb-3 mt-1 ${muted}`}>
            Orders by weekday and hour of day ({manifest?.timezone || "local time"}). Hover a cell for its count.
          </p>
          <DemandHeatmap cells={heatmap} />
        </section>
      ) : null}

      {metrics.recommendations ? (
        <p className={muted}>
          Recommendations:{" "}
          {metrics.recommendations.model === "als_implicit"
            ? `ALS collaborative filtering (rank ${metrics.recommendations.rank}) trained on ${formatNumber(
                metrics.recommendations.interactions
              )} customer–restaurant pairs.`
            : "too few interactions for ALS, so each customer's most-ordered restaurants are used."}{" "}
          They appear under “Recommended for you” on the home page for signed-in customers.
        </p>
      ) : null}
    </div>
  );
};

const AdminPipelinePage = () => {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const [status, setStatus] = useState(null);
  const [realtime, setRealtime] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState("");
  const [simulateOrders, setSimulateOrders] = useState(100);
  const [simulating, setSimulating] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get("/pipeline/status");
      setStatus(response.data.data);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, []);

  const loadRealtime = useCallback(async () => {
    try {
      const response = await api.get("/pipeline/realtime");
      setRealtime(response.data.data);
    } catch {
      // The status request reports connection problems; avoid a second banner.
    }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const response = await api.get("/pipeline/insights");
      setInsights(response.data.data);
    } catch {
      setInsights({ available: false });
    }
  }, []);

  useEffect(() => {
    loadStatus();
    loadRealtime();
    loadInsights();
    const statusTimer = setInterval(loadStatus, STATUS_POLL_MS);
    const realtimeTimer = setInterval(loadRealtime, REALTIME_POLL_MS);
    return () => {
      clearInterval(statusTimer);
      clearInterval(realtimeTimer);
    };
  }, [loadStatus, loadRealtime, loadInsights]);

  // The API pushes a fresh snapshot over Socket.io whenever the windows change.
  useEffect(() => {
    if (!token) {
      return undefined;
    }
    const socket = connectSocket(token);
    socket?.on("pipeline:realtime", setRealtime);
    return () => {
      socket?.off("pipeline:realtime", setRealtime);
    };
  }, [token]);

  const simulate = async () => {
    setSimulating(true);
    try {
      const response = await api.post("/pipeline/simulate", { orders: simulateOrders });
      const result = response.data.data;
      dispatch(
        addToast({
          type: "success",
          message: `Published ${formatNumber(result.totalEvents)} events (${result.orders} orders) via ${
            result.transport === "kafka" ? "Kafka" : "the in-process bus"
          }`,
        })
      );
      await Promise.all([loadStatus(), loadRealtime()]);
    } catch (requestError) {
      dispatch(addToast({ type: "error", message: requestError.message }));
    } finally {
      setSimulating(false);
    }
  };

  if (!status || !realtime) {
    return (
      <div className={card}>
        <p className={muted}>{error ? `Could not load the pipeline status: ${error}` : "Loading pipeline status…"}</p>
      </div>
    );
  }

  const { kafka, events, streaming, batch, lake } = status;
  const sparkStreaming = realtime.engine === SPARK_ENGINE;
  const lakeLayers = [lake.bronze && "bronze", lake.silver && "silver", lake.gold.length && "gold"].filter(Boolean);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Data pipeline</h1>
          <p className={`mt-1 max-w-2xl ${muted}`}>
            Every order, payment and browsing event flows through Kafka. Spark Structured Streaming aggregates it live
            and stores it in the data lake; a Spark batch job turns the history into the models the app serves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 dark:text-slate-400" htmlFor="simulate-orders">
            Simulate
          </label>
          <select
            id="simulate-orders"
            value={simulateOrders}
            onChange={(event) => setSimulateOrders(Number(event.target.value))}
            className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {[25, 100, 250, 500].map((count) => (
              <option key={count} value={count}>
                {count} orders
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={simulate}
            disabled={simulating}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          >
            {simulating ? "Publishing…" : "Send traffic"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          Status is out of date: {error}
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Pipeline stages">
        <StageCard step={1} title="Event producers" tone="ok" status="Publishing">
          <p>{formatNumber(events.totals.produced)} events since the API started.</p>
          <p>Orders, payments, delivery and browser clickstream.</p>
        </StageCard>

        <StageCard
          step={2}
          title="Apache Kafka"
          tone={kafka.connected ? "ok" : "fallback"}
          status={kafka.connected ? "Connected" : "Not connected"}
        >
          {kafka.connected ? (
            <p>
              {kafka.brokers.join(", ")} · {kafka.topics.length} topics · group {kafka.consumerGroup}
            </p>
          ) : (
            <p>
              Events are handled inside the API process instead.{" "}
              {kafka.lastError ? `Last error: ${kafka.lastError}.` : "Set KAFKA_ENABLED=true to use a broker."}
            </p>
          )}
        </StageCard>

        <StageCard
          step={3}
          title="Stream processing"
          tone={sparkStreaming ? "ok" : "fallback"}
          status={sparkStreaming ? "Spark Structured Streaming" : "Spark not running"}
        >
          {sparkStreaming ? (
            <p>{formatNumber(streaming.sparkRecordsReceived)} window updates received from Spark.</p>
          ) : (
            <p>The live windows below are computed by the API process until the Spark streaming job publishes.</p>
          )}
        </StageCard>

        <StageCard
          step={4}
          title="Data lake"
          tone={lakeLayers.length ? "ok" : "idle"}
          status={lakeLayers.length ? `${lakeLayers.join(", ")} present` : "Empty"}
        >
          <p>Bronze: raw Kafka events (Parquet). Silver: cleaned orders. Gold: {lake.gold.length} served datasets.</p>
        </StageCard>

        <StageCard
          step={5}
          title="Spark batch ML"
          tone={batch.available ? "ok" : "idle"}
          status={batch.available ? "Output available" : "Not run yet"}
        >
          {batch.available ? (
            <p>
              {formatNumber(batch.counts?.orders)} orders processed {formatDateTime(batch.generatedAt)} (
              {batch.datasetLabel} data).
            </p>
          ) : (
            <p>ALS recommendations, K-Means segments, FP-Growth rules and the ETA model appear after the first run.</p>
          )}
        </StageCard>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Live stream</h2>
          <p className={muted}>
            Last {realtime.seriesMinutes} minutes in {realtime.windowSeconds}-second windows, computed by{" "}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {sparkStreaming ? "Spark Structured Streaming" : "the API process (fallback)"}
            </span>
            .
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Orders" value={formatNumber(realtime.totals.orders)} />
          <StatTile label="Order value" value={formatCurrency(realtime.totals.revenue)} />
          <StatTile label="Funnel events" value={formatNumber(realtime.totals.events)} hint="page views through payments" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={card}>
            <h3 className={heading}>Orders per minute</h3>
            <div className="mt-3">
              <OrdersPerMinuteChart series={realtime.series} />
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>Conversion funnel</h3>
            <p className={`mb-3 mt-1 ${muted}`}>Events per stage in the last {realtime.seriesMinutes} minutes.</p>
            <div>
              <FunnelBars funnel={realtime.funnel} />
            </div>
          </section>

          <section className={card}>
            <h3 className={heading}>Trending dishes</h3>
            <p className={`mb-3 mt-1 ${muted}`}>Units ordered in the last {realtime.rankingMinutes} minutes.</p>
            <RankedBars
              rows={realtime.trendingItems}
              labelKey="itemName"
              valueKey="quantity"
              emptyText="No orders in this period yet."
            />
          </section>

          <section className={card}>
            <h3 className={heading}>Busiest restaurants</h3>
            <p className={`mb-3 mt-1 ${muted}`}>Orders in the last {realtime.rankingMinutes} minutes.</p>
            <RankedBars
              rows={realtime.topRestaurants.map((row) => ({ ...row, name: row.restaurantName || row.restaurantId }))}
              labelKey="name"
              valueKey="orders"
              detail={(row) => formatCurrency(row.revenue)}
              emptyText="No orders in this period yet."
            />
          </section>
        </div>
      </section>

      <section className={`${card} space-y-4`}>
        <div>
          <h2 className={heading}>Kafka topics</h2>
          <p className={`mt-1 ${muted}`}>Delivery: {kafka.delivery}.</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Events published per {events.throughput.bucketSeconds} seconds
          </p>
          <ThroughputChart series={events.throughput.series} bucketSeconds={events.throughput.bucketSeconds} />
        </div>
        <TopicsTable kafka={kafka} events={events} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">Spark batch insights</h2>
          <button
            type="button"
            onClick={loadInsights}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200"
          >
            Reload
          </button>
        </div>
        <BatchInsights insights={insights} />
      </section>
    </div>
  );
};

export default AdminPipelinePage;
