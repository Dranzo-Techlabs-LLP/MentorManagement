"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

const C = {
  navy: "#1E50A2",
  green: "#2FA84F",
  gold: "#E0A92E",
  teal: "#14A1A8",
  purple: "#6d28d9",
  red: "#e11d48",
};
export const CHART_COLORS = [C.navy, C.green, C.gold, C.teal, C.purple, C.red];

export function TrendLineChart({
  data,
  series,
  height = 260,
}: {
  data: Record<string, number | string>[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 240,
  centerLabel,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  centerLabel?: string;
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-extrabold text-navy">{centerLabel}</span>
        </div>
      )}
    </div>
  );
}

export function SkillRadarChart({
  data,
  series,
  height = 280,
}: {
  data: { axis: string; [k: string]: number | string }[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#475569" }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
        {series.map((s, i) => (
          <Radar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.18}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function GroupBarChart({
  data,
  series,
  height = 260,
}: {
  data: Record<string, number | string>[];
  series: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={42}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
