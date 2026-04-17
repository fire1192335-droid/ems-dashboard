"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CategoryStat, SupplyItem } from "@/types/supply";

type StockChartsProps = {
  categoryStats: CategoryStat[];
  topRestock: SupplyItem[];
};

const CHART_COLORS = {
  total: "#2e67f6",
  lowStock: "#f59e0b",
  outOfStock: "#dc2626",
};

function compactCategoryLabel(label: string) {
  const normalized = label.replace(/\s+/g, " ").trim();
  const match = normalized.match(/^([A-Z])\s*(.*)$/);

  if (!match) {
    return normalized;
  }

  return `${match[1]} ${match[2].slice(0, 6)}`;
}

export function StockCharts({ categoryStats, topRestock }: StockChartsProps) {
  const statusChartData = categoryStats.map((item) => ({
    name: compactCategoryLabel(item.category),
    低庫存: item.lowStock,
    缺貨: item.outOfStock,
  }));

  const totalChartData = categoryStats.map((item) => ({
    name: compactCategoryLabel(item.category),
    品項數: item.total,
  }));

  const restockChartData = topRestock.map((item) => ({
    name: `${item.categoryCode}-${item.number}`,
    fullName: item.name,
    缺口: item.gapToThreshold,
    剩餘數量: item.remainingQuantity,
    狀態: item.status,
  }));

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft">
        <div className="mb-4">
          <p className="text-sm font-medium text-brand-600">圖表一</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">各類別耗材品項數</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={totalChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="品項數" fill={CHART_COLORS.total} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft">
        <div className="mb-4">
          <p className="text-sm font-medium text-brand-600">圖表二</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">低庫存／缺貨統計</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="低庫存" fill={CHART_COLORS.lowStock} radius={[8, 8, 0, 0]} />
              <Bar dataKey="缺貨" fill={CHART_COLORS.outOfStock} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft">
        <div className="mb-4">
          <p className="text-sm font-medium text-brand-600">圖表三</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">前 10 項低庫存耗材</h2>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={restockChartData} layout="vertical" margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={72}
                fontSize={12}
              />
              <Tooltip
                formatter={(value, key) => {
                  if (key === "缺口") {
                    return [`${value}`, "距離安全庫存缺口"];
                  }

                  return [`${value}`, key];
                }}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.fullName ? payload[0].payload.fullName : ""
                }
              />
              <Bar dataKey="缺口" radius={[0, 8, 8, 0]}>
                {restockChartData.map((entry) => (
                  <Cell
                    key={`${entry.name}-${entry.狀態}`}
                    fill={entry.狀態 === "缺貨" ? CHART_COLORS.outOfStock : CHART_COLORS.lowStock}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
