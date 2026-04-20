import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import * as d3 from "d3";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, FunnelChart, Funnel, LabelList, BarChart, Bar } from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import "leaflet/dist/leaflet.css";
import api from "../services/api";
import { connectSocket } from "../services/socket";

const LEAFLET_TILE_API_KEY = import.meta.env.VITE_LEAFLET_TILE_API_KEY || "";
const LEAFLET_TILE_URL = LEAFLET_TILE_API_KEY
  ? `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${LEAFLET_TILE_API_KEY}`
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const LEAFLET_TILE_ATTRIBUTION = LEAFLET_TILE_API_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/" target="_blank">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>'
  : '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap contributors</a>';

const Heatmap = ({ data }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    const width = 680;
    const height = 220;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3.scaleBand().domain(d3.range(0, 24)).range([40, width - 10]).padding(0.05);
    const y = d3.scaleBand().domain(d3.range(1, 8)).range([10, height - 30]).padding(0.05);
    const max = d3.max(data, (d) => d.count) || 1;
    const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, max]);

    svg
      .selectAll("rect.cell")
      .data(data)
      .join("rect")
      .attr("class", "cell")
      .attr("x", (d) => x(d.hour))
      .attr("y", (d) => y(d.dayOfWeek))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", (d) => color(d.count));

    svg
      .append("g")
      .attr("transform", `translate(0,${height - 30})`)
      .call(d3.axisBottom(x).tickValues([0, 4, 8, 12, 16, 20, 23]));

    svg
      .append("g")
      .attr("transform", "translate(40,0)")
      .call(d3.axisLeft(y));
  }, [data]);

  return <svg ref={ref} className="w-full h-[220px]" />;
};

const AdminAnalyticsPage = () => {
  const [state, setState] = useState({
    revenueSeries: [],
    peakHeatmap: [],
    funnel: [],
    cohorts: [],
    topByMargin: [],
    geoDensity: [],
    insights: [],
  });
  const { token } = useSelector((s) => s.auth);

  const load = useCallback(async () => {
    const response = await api.get("/admin/analytics");
    setState(response.data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    socket?.on("analytics:revenue:update", load);
    return () => {
      socket?.off("analytics:revenue:update", load);
    };
  }, [token, load]);

  const exportCsv = async () => {
    const response = await api.get("/admin/analytics/export/csv", { responseType: "blob" });
    saveAs(response.data, "foodex-analytics.csv");
  };

  const exportPdf = async () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Foodex Weekly Insights", 10, 15);
    state.insights.forEach((insight, index) => doc.text(`- ${insight}`, 10, 30 + index * 10));
    doc.save("foodex-analytics.pdf");
  };

  const mapCenter = useMemo(() => {
    if (!state.geoDensity.length) return [28.6139, 77.209];
    return [state.geoDensity[0].lat, state.geoDensity[0].lng];
  }, [state.geoDensity]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Advanced Analytics</h1>
        <div className="flex gap-3">
          <button onClick={exportCsv} className="rounded-full bg-slate-900 text-white px-4 py-2 text-sm">Export CSV</button>
          <button onClick={exportPdf} className="rounded-full bg-orange-500 text-white px-4 py-2 text-sm">Export PDF</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold mb-3">Real-time Revenue</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={state.revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold mb-3">Ordering Heatmap (D3)</h2>
          <Heatmap data={state.peakHeatmap} />
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold mb-3">Funnel</h2>
          <ResponsiveContainer width="100%" height={260}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={state.funnel} isAnimationActive>
                <LabelList position="right" fill="#111827" dataKey="stage" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="font-bold mb-3">Top Dishes By Margin</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={state.topByMargin}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dish" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="margin" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="font-bold mb-3">Geographic Order Density</h2>
        <MapContainer center={mapCenter} zoom={5} className="h-[340px] w-full rounded-xl">
          <TileLayer url={LEAFLET_TILE_URL} attribution={LEAFLET_TILE_ATTRIBUTION} />
          {state.geoDensity.map((pt, index) => (
            <CircleMarker key={index} center={[pt.lat, pt.lng]} radius={Math.max(4, Math.min(20, pt.count / 2))} pathOptions={{ color: "#ef4444" }}>
              <Popup>{pt.city}: {pt.count}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow">
        <h2 className="font-bold mb-3">AI Weekly Insights</h2>
        <ul className="list-disc pl-6 space-y-2">
          {state.insights.map((line, index) => <li key={index}>{line}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
