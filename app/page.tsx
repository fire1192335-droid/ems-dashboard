"use client";

import { useDeferredValue, useEffect, useState } from "react";

import { CategoryTabs } from "@/components/CategoryTabs";
import { StockCharts } from "@/components/StockCharts";
import { SummaryCards } from "@/components/SummaryCards";
import { SuppliesTable } from "@/components/SuppliesTable";
import type { SuppliesApiResponse, SupplyStatus } from "@/types/supply";

type StatusFilter = "全部" | SupplyStatus;
type SortDirection = "asc" | "desc";

type ApiErrorResponse = {
  error?: string;
  details?: string;
};

export default function HomePage() {
  const [data, setData] = useState<SuppliesApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("全部");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  async function requestSupplies() {
    const response = await fetch("/api/supplies", {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorResponse;
      throw new Error(payload.error ?? "讀取耗材資料失敗。");
    }

    return (await response.json()) as SuppliesApiResponse;
  }

  useEffect(() => {
    let isCancelled = false;

    void requestSupplies()
      .then((payload) => {
        if (isCancelled) {
          return;
        }

        setData(payload);
        setError(null);
      })
      .catch((fetchError) => {
        if (isCancelled) {
          return;
        }

        const message = fetchError instanceof Error ? fetchError.message : "讀取耗材資料失敗。";
        setError(message);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleReload() {
    try {
      setIsLoading(true);
      setError(null);

      const payload = await requestSupplies();
      setData(payload);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "讀取耗材資料失敗。";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredSupplies =
    data?.supplies
      .filter((item) => {
        const matchesCategory =
          selectedCategory === "全部" ? true : item.category === selectedCategory;
        const matchesStatus = selectedStatus === "全部" ? true : item.status === selectedStatus;
        const matchesSearch = deferredSearchTerm
          ? item.name.toLowerCase().includes(deferredSearchTerm.toLowerCase())
          : true;

        return matchesCategory && matchesStatus && matchesSearch;
      })
      .sort((a, b) =>
        sortDirection === "asc"
          ? a.remainingQuantity - b.remainingQuantity
          : b.remainingQuantity - a.remainingQuantity,
      ) ?? [];

  const categoryOptions = data?.categoryStats.map((item) => item.category) ?? [];

  return (
    <main className="px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-6 text-white shadow-soft backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium tracking-[0.24em] text-brand-200">
                EMS SUPPLY COMMAND DASHBOARD
              </p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                救護耗材控管儀表板
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                以 Google Sheets 即時盤點資料為核心，快速掌握各類耗材庫存狀態、缺貨風險與補貨優先順序，
                適合消防大隊內部管理與主管簡報使用。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-xs tracking-[0.2em] text-slate-400">DATA SOURCE</p>
                <p className="mt-2 text-sm text-white">Google Sheets API 後端讀取</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4">
                <p className="text-xs tracking-[0.2em] text-slate-400">ERROR HANDLING</p>
                <p className="mt-2 text-sm text-white">讀取失敗時顯示頁面警示與重試按鈕</p>
              </div>
            </div>
          </div>

          {data?.meta.warning ? (
            <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {data.meta.warning}
            </div>
          ) : null}
        </section>

        <div className="mt-6 space-y-6">
          {error ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-soft">
              <h2 className="text-xl font-semibold text-danger">資料讀取失敗</h2>
              <p className="mt-2 text-sm leading-7 text-rose-700">{error}</p>
              <button
                type="button"
                onClick={() => void handleReload()}
                className="mt-4 rounded-full bg-danger px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700"
              >
                重新讀取
              </button>
            </section>
          ) : null}

          {isLoading ? (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-36 animate-pulse rounded-3xl border border-slate-200/80 bg-white/80 shadow-soft"
                />
              ))}
            </section>
          ) : null}

          {data ? (
            <>
              <SummaryCards
                summary={data.summary}
                topRestock={data.topRestock}
                generatedAt={data.meta.generatedAt}
              />

              <StockCharts categoryStats={data.categoryStats} topRestock={data.topRestock} />

              <CategoryTabs
                categoryStats={data.categoryStats}
                selectedCategory={selectedCategory}
                onChange={setSelectedCategory}
              />

              <SuppliesTable
                supplies={filteredSupplies}
                categoryOptions={categoryOptions}
                selectedCategory={selectedCategory}
                selectedStatus={selectedStatus}
                searchTerm={searchTerm}
                sortDirection={sortDirection}
                onCategoryChange={setSelectedCategory}
                onStatusChange={setSelectedStatus}
                onSearchChange={setSearchTerm}
                onSortDirectionChange={setSortDirection}
              />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
