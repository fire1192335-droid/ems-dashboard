"use client";

import type { SuppliesApiResponse } from "@/types/supply";

type SummaryCardsProps = {
  summary: SuppliesApiResponse["summary"];
  topRestock: SuppliesApiResponse["topRestock"];
  generatedAt: string;
};

const metricCards = [
  {
    key: "totalItems",
    label: "總耗材品項數",
    accent: "text-brand-600",
    ring: "ring-brand-100",
  },
  {
    key: "normalItems",
    label: "正常品項數",
    accent: "text-success",
    ring: "ring-emerald-100",
  },
  {
    key: "lowStockItems",
    label: "低庫存品項數",
    accent: "text-warning",
    ring: "ring-amber-100",
  },
  {
    key: "outOfStockItems",
    label: "缺貨品項數",
    accent: "text-danger",
    ring: "ring-rose-100",
  },
] as const;

function getStatusClass(status: string) {
  if (status === "缺貨") {
    return "bg-rose-50 text-danger";
  }

  if (status === "低庫存") {
    return "bg-amber-50 text-warning";
  }

  return "bg-slate-100 text-slate-700";
}

export function SummaryCards({ summary, topRestock, generatedAt }: SummaryCardsProps) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="grid gap-4 sm:grid-cols-2">
        {metricCards.map((card) => (
          <article
            key={card.key}
            className={`rounded-3xl border border-white/70 bg-white/95 p-5 shadow-soft ring-1 ${card.ring}`}
          >
            <p className="text-sm font-medium tracking-wide text-slate-500">{card.label}</p>
            <div className="mt-5 flex items-end justify-between">
              <p className={`text-4xl font-semibold ${card.accent}`}>{summary[card.key]}</p>
              <p className="text-xs text-slate-400">即時盤點</p>
            </div>
          </article>
        ))}
      </div>

      <article className="rounded-3xl border border-white/70 bg-slate-950 bg-grid bg-[length:18px_18px] p-5 text-white shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm tracking-[0.2em] text-slate-400">TOP 10 RESTOCK</p>
            <h2 className="mt-2 text-2xl font-semibold">最需要補貨的前 10 項</h2>
          </div>
          <p className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
            {new Date(generatedAt).toLocaleString("zh-TW", {
              hour12: false,
            })}
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {topRestock.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-400">
                  #{String(index + 1).padStart(2, "0")} · {item.categoryCode} · {item.number}
                </p>
                <p className="truncate text-base font-medium text-white">{item.name}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(item.status)}`}>
                  {item.status}
                </span>
                <p className="mt-2 text-sm text-slate-300">
                  {item.remainingQuantity} / 門檻 {item.safetyStockThreshold}
                </p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
