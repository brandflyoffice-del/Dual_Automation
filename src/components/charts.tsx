"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUsd } from "@/lib/utils";

const AXIS = { fill: "#5b6477", fontSize: 11 };
const tooltipStyle = {
  contentStyle: {
    background: "#ffffff",
    border: "1px solid rgba(15,23,42,0.12)",
    borderRadius: 8,
    fontSize: 12,
    color: "#0f172a",
  },
  itemStyle: { color: "#0f172a" },
  labelStyle: { color: "#5b6477" },
  cursor: { fill: "rgba(15,23,42,0.04)" },
} as const;

const FUNNEL_LABEL: Record<string, string> = {
  "Follow-Up 1": "Follow 1",
  "Follow-Up 2": "Follow 2",
  "Follow-Up 3": "Follow 3",
  "Positive Reply": "Positive",
  "Meeting Booked": "Booked",
};

export function FunnelChart({ data }: { data: { stage: string; value: number }[] }) {
  const top = data[0]?.value || 1;
  const rows = data.map((d) => ({ ...d, stage: FUNNEL_LABEL[d.stage] ?? d.stage }));
  const shades = ["#4f46e5", "#5a58e6", "#4f74e0", "#2f86c9", "#1b9a9a", "#10a37f", "#059669", "#0b8f5f"];
  return (
    <div className="h-[300px] w-full min-w-0 sm:h-[340px]">
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 40, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis type="number" hide domain={[0, top]} />
          <YAxis type="category" dataKey="stage" tick={{ ...AXIS, fontSize: 11 }} width={72} axisLine={false} tickLine={false} interval={0} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number) => [`${v} (${((v / top) * 100).toFixed(1)}% of scraped)`, "Leads"]}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={22}
            label={{ position: "right", fill: "#0f172a", fontSize: 12, fontFamily: "var(--font-jetbrains)" }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={shades[i % shades.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GeoChart({
  data,
}: {
  data: { name: string; region: string; leads: number; emailed: number; positive: number; meetings: number }[];
}) {
  const rows = data.map((d) => ({ ...d, name: d.region === "EUROPE" ? "Europe" : d.region }));
  return (
    <div className="h-[240px] w-full sm:h-[300px]">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ left: 0, right: 4, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#5b6477" }} iconType="circle" iconSize={8} />
          <Bar dataKey="leads" name="Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="emailed" name="Emailed" fill="#4f9bd6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="positive" name="Positive replies" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="meetings" name="Meetings" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ServiceChart({
  data,
}: {
  data: { name: string; color: string; leads: number; pipeline: number; booked: number }[];
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="mx-auto h-[168px] w-full max-w-[200px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="leads" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="min-w-0 space-y-2">
        {data.map((d) => (
          <li key={d.name} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_4.5rem] items-center gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="font-metric whitespace-nowrap text-xs text-foreground">{d.leads}</span>
            <span className="font-metric whitespace-nowrap text-right text-xs text-muted-foreground">{formatUsd(d.pipeline, true)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StepBars({ data }: { data: { name: string; openRate: number; replyRate: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.07)" />
          <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} unit="%" />
          <Tooltip {...tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#5b6477" }} iconType="circle" iconSize={8} />
          <Bar dataKey="openRate" name="Open rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="replyRate" name="Reply rate" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
