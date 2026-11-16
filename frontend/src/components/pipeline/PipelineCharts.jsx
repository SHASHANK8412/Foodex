import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatNumber } from "../../utils/format";

// Charts for the Data Pipeline page. Every chart encodes one measure in one hue
// (colours come from the --viz-* variables in index.css, with light and dark
// values), and each has a hover readout or direct value labels.

const formatClock = (value) =>
  new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

const axisTick = { fill: "var(--viz-axis)", fontSize: 11 };

const TooltipCard = ({ title, rows }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md dark:border-slate-700 dark:bg-slate-900">
    <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
    {rows.map(([label, value]) => (
      <p key={label} className="mt-0.5 text-slate-600 dark:text-slate-300">
        {label}: <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      </p>
    ))}
  </div>
);

const EmptyChart = ({ children, height = 220 }) => (
  <div
    className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 px-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
    style={{ height }}
  >
    {children}
  </div>
);

export const OrdersPerMinuteChart = ({ series }) => {
  if (!series?.some((point) => point.orders > 0)) {
    return <EmptyChart>No orders in the last {series?.length || 30} minutes. Place an order or simulate traffic.</EmptyChart>;
  }

  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={series} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="windowStart"
            tickFormatter={formatClock}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--viz-grid)" }}
            interval={4}
          />
          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--viz-axis)", strokeDasharray: "3 3" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={`${formatClock(payload[0].payload.windowStart)} (1-minute window)`}
                  rows={[
                    ["Orders", formatNumber(payload[0].payload.orders)],
                    ["Order value", formatCurrency(payload[0].payload.revenue)],
                  ]}
                />
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="orders"
            stroke="var(--viz-series)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: "var(--viz-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const ThroughputChart = ({ series, bucketSeconds }) => {
  if (!series?.some((point) => point.events > 0)) {
    return <EmptyChart height={120}>No events published in the last five minutes.</EmptyChart>;
  }

  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap={2}>
          <XAxis dataKey="at" tickFormatter={formatClock} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--viz-grid)" }} interval={5} />
          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: "var(--viz-grid)", opacity: 0.5 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipCard
                  title={`${new Date(payload[0].payload.at).toLocaleTimeString("en-IN", { hour12: false })} (${bucketSeconds}s)`}
                  rows={[["Events published", formatNumber(payload[0].payload.events)]]}
                />
              ) : null
            }
          />
          <Bar dataKey="events" fill="var(--viz-series)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// A ranked list: label, a bar scaled to the largest value, and the value itself.
export const RankedBars = ({ rows, labelKey, valueKey, formatValue = formatNumber, detail, emptyText }) => {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  }

  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);

  return (
    <ul className="viz-root space-y-2.5">
      {rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return (
          <li key={row[labelKey]} title={`${row[labelKey]}: ${formatValue(value)}`}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-800 dark:text-slate-100">{row[labelKey]}</span>
              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatValue(value)}</span>
                {detail ? <span className="ml-2 text-xs">{detail(row)}</span> : null}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-r bg-slate-100 dark:bg-slate-800">
              <div
                className="h-2 rounded-r"
                style={{ width: `${Math.max(1, (value / max) * 100)}%`, background: "var(--viz-series)" }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const STAGE_LABELS = {
  page_view: "Page views",
  restaurant_view: "Restaurant views",
  add_to_cart: "Added to cart",
  checkout_started: "Checkout started",
  order_placed: "Orders placed",
  payment_completed: "Payments completed",
};

export const FunnelBars = ({ funnel }) => {
  if (!funnel?.some((stage) => stage.events > 0)) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No funnel events in this period yet.</p>;
  }

  // Counts are events, not visitors: one visitor can add several items to the
  // cart, so a stage can be larger than the one before it.
  const rows = funnel.map((stage) => ({ label: STAGE_LABELS[stage.stage] || stage.stage, events: stage.events }));

  return <RankedBars rows={rows} labelKey="label" valueKey="events" />;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Orders by weekday and hour. One hue; a busier cell is more saturated and an
// empty one fades into the card, in both light and dark themes.
export const DemandHeatmap = ({ cells }) => {
  if (!cells?.length) {
    return null;
  }

  const byCell = new Map(cells.map((cell) => [`${cell.dayOfWeek}-${cell.hour}`, Number(cell.orders) || 0]));
  const max = Math.max(...byCell.values(), 1);
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="viz-root overflow-x-auto">
      <div className="min-w-[560px]">
        {DAY_LABELS.map((day, index) => (
          <div key={day} className="flex items-center gap-[2px] pb-[2px]">
            <span className="w-9 shrink-0 text-xs text-slate-500 dark:text-slate-400">{day}</span>
            {hours.map((hour) => {
              const orders = byCell.get(`${index + 1}-${hour}`) || 0;
              return (
                <div
                  key={hour}
                  title={`${day} ${String(hour).padStart(2, "0")}:00 — ${formatNumber(orders)} orders`}
                  className="h-5 flex-1 rounded-sm"
                  style={{ background: "var(--viz-series)", opacity: 0.06 + 0.94 * (orders / max) }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex gap-[2px] pt-1">
          <span className="w-9 shrink-0" />
          {hours.map((hour) => (
            <span key={hour} className="flex-1 text-center text-[10px] text-slate-500 dark:text-slate-400">
              {hour % 3 === 0 ? hour : ""}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Fewer orders</span>
          <span className="flex gap-[2px]">
            {[0.06, 0.3, 0.55, 0.8, 1].map((opacity) => (
              <span key={opacity} className="h-3 w-5 rounded-sm" style={{ background: "var(--viz-series)", opacity }} />
            ))}
          </span>
          <span>More (max {formatNumber(max)})</span>
        </div>
      </div>
    </div>
  );
};
