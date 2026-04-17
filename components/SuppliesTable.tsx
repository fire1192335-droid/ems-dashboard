"use client";

import type { SupplyItem, SupplyStatus } from "@/types/supply";

type StatusFilter = "全部" | SupplyStatus;
type SortDirection = "asc" | "desc";

type SuppliesTableProps = {
  supplies: SupplyItem[];
  categoryOptions: string[];
  selectedCategory: string;
  selectedStatus: StatusFilter;
  searchTerm: string;
  sortDirection: SortDirection;
  onCategoryChange: (value: string) => void;
  onStatusChange: (value: StatusFilter) => void;
  onSearchChange: (value: string) => void;
  onSortDirectionChange: (value: SortDirection) => void;
};

function getStatusStyle(status: SupplyStatus) {
  if (status === "缺貨") {
    return "bg-rose-50 text-danger ring-rose-100";
  }

  if (status === "低庫存") {
    return "bg-amber-50 text-warning ring-amber-100";
  }

  return "bg-emerald-50 text-success ring-emerald-100";
}

export function SuppliesTable({
  supplies,
  categoryOptions,
  selectedCategory,
  selectedStatus,
  searchTerm,
  sortDirection,
  onCategoryChange,
  onStatusChange,
  onSearchChange,
  onSortDirectionChange,
}: SuppliesTableProps) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">耗材清單</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">可搜尋、可篩選、可排序</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-500">搜尋品名</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="輸入耗材名稱"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-500">類別篩選</span>
            <select
              value={selectedCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            >
              <option value="全部">全部</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-500">狀態篩選</span>
            <select
              value={selectedStatus}
              onChange={(event) => onStatusChange(event.target.value as StatusFilter)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            >
              <option value="全部">全部</option>
              <option value="正常">正常</option>
              <option value="低庫存">低庫存</option>
              <option value="缺貨">缺貨</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-500">剩餘數量排序</span>
            <button
              type="button"
              onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span>{sortDirection === "asc" ? "由少到多" : "由多到少"}</span>
              <span className="text-brand-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
            </button>
          </label>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200">
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-sm text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">類別</th>
                <th className="px-4 py-3 font-medium">編號</th>
                <th className="px-4 py-3 font-medium">品名</th>
                <th className="px-4 py-3 font-medium">剩餘數量</th>
                <th className="px-4 py-3 font-medium">單位</th>
                <th className="px-4 py-3 font-medium">狀態</th>
                <th className="px-4 py-3 font-medium">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {supplies.map((item) => (
                <tr key={item.id} className="align-top text-sm text-slate-700">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{item.categoryCode}</div>
                    <div className="text-slate-500">{item.category}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{item.number}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{item.remainingQuantity}</div>
                    <div className="text-xs text-slate-500">門檻 {item.safetyStockThreshold}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.unit}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-3 md:hidden">
          {supplies.map((item) => (
            <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium tracking-[0.2em] text-slate-500">
                    {item.categoryCode} · {item.number}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">{item.name}</h3>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getStatusStyle(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">類別</dt>
                  <dd className="mt-1 text-slate-900">{item.category}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">剩餘數量</dt>
                  <dd className="mt-1 text-slate-900">
                    {item.remainingQuantity} {item.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">安全庫存</dt>
                  <dd className="mt-1 text-slate-900">{item.safetyStockThreshold}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">備註</dt>
                  <dd className="mt-1 text-slate-900">{item.note ?? "-"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </div>

      {supplies.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-slate-500">
          目前篩選條件沒有符合的耗材資料。
        </div>
      ) : null}
    </section>
  );
}
