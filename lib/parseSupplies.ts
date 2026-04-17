import type {
  CategoryStat,
  SuppliesApiResponse,
  SupplyItem,
  SupplyStatus,
} from "@/types/supply";

type CategoryBlock = {
  category: string;
  categoryCode: string;
  startIndex: number;
  endIndex: number;
  quantityIndex?: number;
  unitIndex?: number;
  thresholdIndex?: number;
};

const HEADER_ROW_INDEX = 1;
const NUMBER_HEADER_ROW_INDEX = 2;
const DATA_START_ROW_INDEX = 3;

const QUANTITY_LABEL = /剩餘|數量|庫存/i;
const UNIT_LABEL = /單位/i;
const THRESHOLD_LABEL = /安全|警示|門檻|下限/i;

function normalizeCell(value?: string) {
  return (value ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDigits(value: string) {
  return value.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

function isCategoryHeader(cell: string) {
  const normalized = normalizeCell(cell);

  if (!normalized) {
    return false;
  }

  if (normalized.includes("類別") || QUANTITY_LABEL.test(normalized) || UNIT_LABEL.test(normalized)) {
    return false;
  }

  return /^[A-Z]\b|^[A-Z][\s\S]/.test(normalized);
}

function toCategoryCode(category: string) {
  const match = normalizeCell(category).match(/[A-Z]/);
  return match?.[0] ?? "X";
}

function parseNumberValue(rawValue: string) {
  const normalized = normalizeDigits(normalizeCell(rawValue)).replace(/,/g, "");

  if (!normalized) {
    return { value: 0 };
  }

  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return { value: Number(normalized) };
  }

  const matches = normalized.match(/\d+(\.\d+)?/g);

  if (!matches) {
    return {
      value: 0,
      note: `原始數量：${rawValue}`,
    };
  }

  const total = matches.reduce((sum, current) => sum + Number(current), 0);

  return {
    value: total,
    note: `原始數量：${rawValue}`,
  };
}

function inferSafetyStockThreshold(quantity: number, unit: string) {
  const normalizedUnit = normalizeCell(unit);
  const unitFloor = /盒|箱|組|套/.test(normalizedUnit)
    ? 3
    : /包|片|條|捲|個|支|副|袋|雙/.test(normalizedUnit)
      ? 5
      : /罐|桶|瓶/.test(normalizedUnit)
        ? 2
        : 3;

  const scaledFloor =
    quantity >= 200
      ? 20
      : quantity >= 100
        ? 10
        : quantity >= 50
          ? 8
          : quantity >= 20
            ? 5
            : quantity >= 10
              ? 3
              : 1;

  return Math.max(unitFloor, scaledFloor);
}

function resolveStatus(quantity: number, threshold: number): SupplyStatus {
  if (quantity === 0) {
    return "缺貨";
  }

  if (quantity < threshold) {
    return "低庫存";
  }

  return "正常";
}

function compareSupplyRows(a: SupplyItem, b: SupplyItem) {
  const severity = { 缺貨: 0, 低庫存: 1, 正常: 2 };

  if (severity[a.status] !== severity[b.status]) {
    return severity[a.status] - severity[b.status];
  }

  if (a.gapToThreshold !== b.gapToThreshold) {
    return b.gapToThreshold - a.gapToThreshold;
  }

  if (a.remainingQuantity !== b.remainingQuantity) {
    return a.remainingQuantity - b.remainingQuantity;
  }

  return a.number.localeCompare(b.number, "zh-Hant");
}

function findNumberColumn(rows: string[][]) {
  const headerRow = rows[NUMBER_HEADER_ROW_INDEX] ?? [];
  const index = headerRow.findIndex((cell) => normalizeCell(cell).includes("編號"));
  return index >= 0 ? index : 1;
}

function buildCategoryBlocks(rows: string[][]) {
  const headerRow = rows[HEADER_ROW_INDEX] ?? [];
  const startIndexes = headerRow
    .map((cell, index) => (isCategoryHeader(cell) ? index : -1))
    .filter((index) => index >= 0);

  return startIndexes.map<CategoryBlock>((startIndex, blockIndex) => {
    const endIndex = startIndexes[blockIndex + 1] ?? headerRow.length;
    const blockHeaders = headerRow.slice(startIndex, endIndex).map(normalizeCell);
    const quantityOffset = blockHeaders.findIndex((cell) => QUANTITY_LABEL.test(cell));
    const unitOffset = blockHeaders.findIndex((cell) => UNIT_LABEL.test(cell));
    const thresholdOffset = blockHeaders.findIndex((cell) => THRESHOLD_LABEL.test(cell));
    const category = normalizeCell(headerRow[startIndex]);

    return {
      category,
      categoryCode: toCategoryCode(category),
      startIndex,
      endIndex,
      quantityIndex: quantityOffset >= 0 ? startIndex + quantityOffset : undefined,
      unitIndex: unitOffset >= 0 ? startIndex + unitOffset : undefined,
      thresholdIndex: thresholdOffset >= 0 ? startIndex + thresholdOffset : undefined,
    };
  });
}

function getItemName(row: string[], block: CategoryBlock) {
  const nameLimit = block.quantityIndex ?? block.endIndex;
  const candidates = row.slice(block.startIndex, nameLimit).map(normalizeCell);
  return candidates.find(Boolean) ?? "";
}

function buildCategoryStats(supplies: SupplyItem[]) {
  const categoryMap = new Map<string, CategoryStat>();

  for (const supply of supplies) {
    const current =
      categoryMap.get(supply.category) ??
      {
        category: supply.category,
        categoryCode: supply.categoryCode,
        total: 0,
        normal: 0,
        lowStock: 0,
        outOfStock: 0,
      };

    current.total += 1;

    if (supply.status === "正常") {
      current.normal += 1;
    } else if (supply.status === "低庫存") {
      current.lowStock += 1;
    } else {
      current.outOfStock += 1;
    }

    categoryMap.set(supply.category, current);
  }

  return Array.from(categoryMap.values()).sort((a, b) =>
    a.categoryCode.localeCompare(b.categoryCode, "en"),
  );
}

export function parseSupplies(rows: string[][]): SuppliesApiResponse {
  if (rows.length <= DATA_START_ROW_INDEX) {
    throw new Error("Google Sheets range did not return any supply rows.");
  }

  const numberColumnIndex = findNumberColumn(rows);
  const blocks = buildCategoryBlocks(rows);

  if (blocks.length === 0) {
    throw new Error("Unable to detect category blocks from the Google Sheets header row.");
  }

  const supplies: SupplyItem[] = [];
  let derivedThresholdCount = 0;
  let sheetThresholdCount = 0;

  for (const row of rows.slice(DATA_START_ROW_INDEX)) {
    const number = normalizeCell(row[numberColumnIndex]);

    if (!number) {
      continue;
    }

    for (const block of blocks) {
      const name = getItemName(row, block);

      if (!name) {
        continue;
      }

      const rawQuantity = normalizeCell(row[block.quantityIndex ?? -1]);
      const rawUnit = normalizeCell(row[block.unitIndex ?? -1]);
      const rawThreshold = normalizeCell(row[block.thresholdIndex ?? -1]);

      const quantityResult = parseNumberValue(rawQuantity);
      const thresholdResult = rawThreshold
        ? parseNumberValue(rawThreshold)
        : { value: inferSafetyStockThreshold(quantityResult.value, rawUnit) };

      if (rawThreshold) {
        sheetThresholdCount += 1;
      } else {
        derivedThresholdCount += 1;
      }

      const noteParts = [quantityResult.note].filter(Boolean) as string[];
      const unit = rawUnit || "未填";
      const safetyStockThreshold = Math.max(0, Math.round(thresholdResult.value));
      const remainingQuantity = Math.max(0, Math.round(quantityResult.value));
      const status = resolveStatus(remainingQuantity, safetyStockThreshold);

      supplies.push({
        id: `${block.categoryCode}-${number}-${supplies.length + 1}`,
        number,
        category: block.category,
        categoryCode: block.categoryCode,
        name,
        remainingQuantity,
        unit,
        safetyStockThreshold,
        status,
        note: noteParts[0],
        rawQuantity: rawQuantity || undefined,
        gapToThreshold: Math.max(safetyStockThreshold - remainingQuantity, 0),
      });
    }
  }

  const orderedSupplies = supplies.sort((a, b) => {
    const categoryCompare = a.categoryCode.localeCompare(b.categoryCode, "en");

    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return a.number.localeCompare(b.number, "zh-Hant");
  });

  const summary = {
    totalItems: orderedSupplies.length,
    normalItems: orderedSupplies.filter((item) => item.status === "正常").length,
    lowStockItems: orderedSupplies.filter((item) => item.status === "低庫存").length,
    outOfStockItems: orderedSupplies.filter((item) => item.status === "缺貨").length,
  };

  const categoryStats = buildCategoryStats(orderedSupplies);
  const urgentSupplies = orderedSupplies.filter((item) => item.status !== "正常");
  const topRestock = [...(urgentSupplies.length > 0 ? urgentSupplies : orderedSupplies)]
    .sort(compareSupplyRows)
    .slice(0, 10);

  const thresholdMode =
    sheetThresholdCount > 0 && derivedThresholdCount > 0
      ? "mixed"
      : sheetThresholdCount > 0
        ? "sheet"
        : "derived";

  const warning =
    thresholdMode === "derived" || thresholdMode === "mixed"
      ? "目前試算表未提供完整安全庫存欄位，系統會以耗材單位與庫存量推估警示門檻。"
      : undefined;

  return {
    supplies: orderedSupplies,
    summary,
    categoryStats,
    topRestock,
    meta: {
      generatedAt: new Date().toISOString(),
      thresholdMode,
      warning,
    },
  };
}
