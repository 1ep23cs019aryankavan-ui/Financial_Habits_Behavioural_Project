"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  indigo: "#6366f1",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  slate: "#94a3b8",
} as const;

const TOOLTIP_STYLE = {
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: "0.75rem",
} as const;

const AXIS = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
} as const;

export type CategoryDatum = { category: string; total: number; count: number };
export type OutcomeDatum = { name: string; value: number; key: string };
export type TrendDatum = { label: string; resilience: number; decided: number };

/** Horizontal bars read better than a pie when category labels are long. */
export function CategoryChart({ data }: { data: CategoryDatum[] }) {
  if (data.length === 0) {
    return <EmptyState message="Log a decision to see spending by category." />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
        >
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" {...AXIS} tickFormatter={(v) => `$${v}`} />
          <YAxis type="category" dataKey="category" width={92} {...AXIS} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const datum = item?.payload as CategoryDatum | undefined;
              const amount = Number(value ?? 0);
              return [
                `$${amount.toLocaleString()} · ${datum?.count ?? 0} decision(s)`,
                "Total logged",
              ];
            }}
          />
          <Bar dataKey="total" fill={COLORS.indigo} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OutcomeChart({ data }: { data: OutcomeDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return <EmptyState message="Complete a cooling-off period to see outcomes." />;
  }

  const colorFor: Record<string, string> = {
    APPROVED: COLORS.sky,
    RECONSIDERED: COLORS.emerald,
    CANCELLED: COLORS.slate,
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={82}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.key} fill={colorFor[entry.key] ?? COLORS.slate} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend
            verticalAlign="bottom"
            height={24}
            iconType="circle"
            wrapperStyle={{ fontSize: "0.75rem" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendDatum[] }) {
  const hasData = data.some((d) => d.decided > 0);

  if (!hasData) {
    return <EmptyState message="Your weekly pattern appears once you resolve decisions." />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...AXIS} />
          <YAxis {...AXIS} unit="%" domain={[0, 100]} width={40} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value, _name, item) => {
              const datum = item?.payload as TrendDatum | undefined;
              return [
                `${Number(value ?? 0)}% of ${datum?.decided ?? 0} decision(s)`,
                "Reconsidered",
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="resilience"
            stroke={COLORS.emerald}
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: COLORS.emerald }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
