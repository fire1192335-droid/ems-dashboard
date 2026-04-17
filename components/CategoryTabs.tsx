"use client";

import type { CategoryStat } from "@/types/supply";

type CategoryTabsProps = {
  categoryStats: CategoryStat[];
  selectedCategory: string;
  onChange: (category: string) => void;
};

export function CategoryTabs({
  categoryStats,
  selectedCategory,
  onChange,
}: CategoryTabsProps) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">分類總覽</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">耗材分類區塊</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChange("全部")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              selectedCategory === "全部"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            全部分類
          </button>
          {categoryStats.map((category) => (
            <button
              key={category.category}
              type="button"
              onClick={() => onChange(category.category)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                selectedCategory === category.category
                  ? "bg-brand-600 text-white"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
              }`}
            >
              {category.categoryCode}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {categoryStats.map((category) => {
          const isActive = selectedCategory === category.category;

          return (
            <button
              type="button"
              key={category.category}
              onClick={() => onChange(category.category)}
              className={`rounded-3xl border p-4 text-left transition ${
                isActive
                  ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                  : "border-slate-200 bg-slate-50 hover:border-brand-200 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.24em] text-slate-500">
                    CATEGORY {category.categoryCode}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">{category.category}</h3>
                </div>
                <p className="text-3xl font-semibold text-slate-900">{category.total}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-success">
                  <p>正常</p>
                  <p className="mt-1 text-base font-semibold">{category.normal}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-2 text-warning">
                  <p>低庫存</p>
                  <p className="mt-1 text-base font-semibold">{category.lowStock}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 px-3 py-2 text-danger">
                  <p>缺貨</p>
                  <p className="mt-1 text-base font-semibold">{category.outOfStock}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
