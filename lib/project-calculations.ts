import type { BoqCategory, BoqItem, Project } from "@/lib/project-storage";

export const DAILY_PROGRESS_PRESETS = [0, 30, 60, 90, 100] as const;

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function nonNegativeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

export function calculateItemTotal(item: BoqItem): number {
  return nonNegativeNumber(item.quantity) * nonNegativeNumber(item.unitPrice);
}

export function calculateCategoryTotal(category: BoqCategory): number {
  return category.items.reduce((total, item) => total + calculateItemTotal(item), 0);
}

export function calculateOverallBoqTotal(project: Project): number {
  return project.boq.reduce((total, category) => total + calculateCategoryTotal(category), 0);
}

export function calculateCategoryProgress(category: BoqCategory): number {
  const categoryTotal = calculateCategoryTotal(category);

  if (categoryTotal <= 0) {
    return 0;
  }

  const weightedAmount = category.items.reduce((total, item) => {
    return total + calculateItemTotal(item) * (clampProgress(item.progress) / 100);
  }, 0);

  return clampProgress((weightedAmount / categoryTotal) * 100);
}

export function calculateWeightedProgress(project: Project): number {
  const overallTotal = calculateOverallBoqTotal(project);

  if (overallTotal <= 0) {
    return 0;
  }

  const weightedAmount = project.boq.reduce((projectTotal, category) => {
    return (
      projectTotal +
      category.items.reduce((categoryTotal, item) => {
        return categoryTotal + calculateItemTotal(item) * (clampProgress(item.progress) / 100);
      }, 0)
    );
  }, 0);

  return clampProgress((weightedAmount / overallTotal) * 100);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(nonNegativeNumber(value));
}

function formatCompactUnitValue(value: number): string {
  const safeValue = nonNegativeNumber(value);

  if (safeValue < 1_000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(safeValue);
  }

  const units = [
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" }
  ] as const;

  const unit = units.find((entry) => safeValue >= entry.threshold);

  if (!unit) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(safeValue);
  }

  const scaledValue = safeValue / unit.threshold;
  const maximumFractionDigits = scaledValue < 10 ? 2 : scaledValue < 100 ? 1 : 0;
  const compact = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(scaledValue);

  return `${compact}${unit.suffix}`;
}

export function formatCompactNumber(value: number): string {
  return formatCompactUnitValue(value);
}

export function formatCompactCurrency(value: number): string {
  const safeValue = nonNegativeNumber(value);

  if (safeValue < 100_000) {
    return formatCurrency(safeValue);
  }

  return `฿${formatCompactUnitValue(safeValue)}`;
}

export function formatPercent(value: number): string {
  return `${clampProgress(value).toFixed(1)}%`;
}

export function applyProgressPreset(value: number): number {
  return clampProgress(value);
}
