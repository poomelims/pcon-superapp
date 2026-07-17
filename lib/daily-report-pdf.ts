export type PdfExportGate = {
  hasProject: boolean;
  hasReport: boolean;
  hasExportRoot: boolean;
};

export type PdfImageLayoutInput = {
  canvasWidth: number;
  canvasHeight: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
  marginMm?: number;
};

export type PdfImageLayout = {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  imageWidthMm: number;
  imageHeightMm: number;
  pageCount: number;
  pageYPositions: number[];
};

export type PdfPageSliceInput = {
  canvasWidth: number;
  canvasHeight: number;
  pageWidthMm?: number;
  pageHeightMm?: number;
  marginMm?: number;
  breakpointsPx?: number[];
  forcedBreakpointsPx?: number[];
};

export type PdfPageSlice = {
  topPx: number;
  heightPx: number;
};

export type PdfExportMode = "default" | "exact-a4";

export type PdfExportOptions = {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  imageQuality: number;
};

export function canExportDailyReportPdf({ hasProject, hasReport, hasExportRoot }: PdfExportGate): boolean {
  return hasProject && hasReport && hasExportRoot;
}

export function getPdfExportOptions(mode: PdfExportMode = "default"): PdfExportOptions {
  if (mode === "exact-a4") {
    return {
      pageWidthMm: 210,
      pageHeightMm: 297,
      marginMm: 0,
      imageQuality: 0.95
    };
  }

  return {
    pageWidthMm: 210,
    pageHeightMm: 297,
    marginMm: 10,
    imageQuality: 0.92
  };
}

export function calculatePdfImageLayout({
  canvasWidth,
  canvasHeight,
  pageWidthMm = 210,
  pageHeightMm = 297,
  marginMm = 10
}: PdfImageLayoutInput): PdfImageLayout {
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const imageWidthMm = contentWidthMm;
  const imageHeightMm = (safeCanvasHeight * imageWidthMm) / safeCanvasWidth;
  const pageCount = Math.max(1, Math.ceil(imageHeightMm / contentHeightMm));
  const pageYPositions = Array.from({ length: pageCount }, (_, index) => marginMm - index * contentHeightMm);

  return {
    pageWidthMm,
    pageHeightMm,
    marginMm,
    contentWidthMm,
    contentHeightMm,
    imageWidthMm,
    imageHeightMm,
    pageCount,
    pageYPositions
  };
}

function uniqueSortedBreakpoints(breakpointsPx: number[] | undefined, canvasHeight: number): number[] {
  return Array.from(new Set([0, ...(breakpointsPx ?? []), canvasHeight]))
    .map((value) => Math.round(value))
    .filter((value) => value >= 0 && value <= canvasHeight)
    .sort((a, b) => a - b);
}

export function calculatePdfPageSlices({
  canvasWidth,
  canvasHeight,
  pageWidthMm = 210,
  pageHeightMm = 297,
  marginMm = 10,
  breakpointsPx,
  forcedBreakpointsPx
}: PdfPageSliceInput): PdfPageSlice[] {
  const safeCanvasWidth = Math.max(1, canvasWidth);
  const safeCanvasHeight = Math.max(1, canvasHeight);
  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const maxSliceHeightPx = Math.round((contentHeightMm * safeCanvasWidth) / contentWidthMm);
  const breakpoints = uniqueSortedBreakpoints(breakpointsPx, safeCanvasHeight);
  const forcedBreakpoints = uniqueSortedBreakpoints(forcedBreakpointsPx, safeCanvasHeight);
  const slices: PdfPageSlice[] = [];
  let topPx = 0;

  while (topPx < safeCanvasHeight) {
    const maxBottomPx = Math.min(safeCanvasHeight, topPx + maxSliceHeightPx);
    const forcedBottomPx = forcedBreakpoints.find((point) => point > topPx && point <= maxBottomPx);
    const safeBottomPx = [...breakpoints].reverse().find((point) => point > topPx && point <= maxBottomPx);
    const bottomPx = forcedBottomPx ?? safeBottomPx ?? maxBottomPx;
    const heightPx = Math.max(1, bottomPx - topPx);

    slices.push({ topPx, heightPx });
    topPx = bottomPx;
  }

  return slices;
}

function createCanvasSlice(sourceCanvas: HTMLCanvasElement, topPx: number, heightPx: number): HTMLCanvasElement {
  const sliceCanvas = document.createElement("canvas");
  const sliceHeight = Math.min(heightPx, sourceCanvas.height - topPx);
  const context = sliceCanvas.getContext("2d");

  sliceCanvas.width = sourceCanvas.width;
  sliceCanvas.height = sliceHeight;

  if (context) {
    context.drawImage(sourceCanvas, 0, topPx, sourceCanvas.width, sliceHeight, 0, 0, sourceCanvas.width, sliceHeight);
  }

  return sliceCanvas;
}

type PdfBreakpoints = {
  breakpointsPx: number[];
  forcedBreakpointsPx: number[];
};

function collectPdfBreakpoints(element: HTMLElement, canvasHeight: number): PdfBreakpoints {
  const rootRect = element.getBoundingClientRect();
  const rootHeight = Math.max(1, element.scrollHeight);
  const scaleY = canvasHeight / rootHeight;
  const selectors = ['[data-pdf-section="true"]', '[data-pdf-photo-card="true"]'];
  const breakpoints = selectors.flatMap((selector) =>
    Array.from(element.querySelectorAll<HTMLElement>(selector)).flatMap((node) => {
      const nodeRect = node.getBoundingClientRect();
      const top = Math.max(0, nodeRect.top - rootRect.top + element.scrollTop) * scaleY;
      const bottom = Math.max(0, nodeRect.bottom - rootRect.top + element.scrollTop) * scaleY;

      return [top, bottom];
    })
  );
  const forcedBreakpoints = Array.from(element.querySelectorAll<HTMLElement>('[data-pdf-force-page-break="before"]')).map((node) => {
    const nodeRect = node.getBoundingClientRect();
    return Math.max(0, nodeRect.top - rootRect.top + element.scrollTop) * scaleY;
  });

  return {
    breakpointsPx: [0, ...breakpoints, ...forcedBreakpoints, canvasHeight],
    forcedBreakpointsPx: forcedBreakpoints
  };
}

async function waitForPdfImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll<HTMLImageElement>("img"));

  await Promise.all(
    images.map(async (image) => {
      if (image.complete && image.naturalWidth > 0) {
        return;
      }

      if (typeof image.decode === "function") {
        try {
          await image.decode();
          return;
        } catch {
          // Fall back to load/error listeners below when decode rejects for a cached data URL.
        }
      }

      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 5000);
        const finish = () => {
          window.clearTimeout(timeout);
          resolve();
        };

        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
      });
    })
  );
}

type PdfSafeColors = {
  backgroundColor: string;
  borderColor: string;
  color: string;
};

export function pdfSafeColorsForClassName(className: string): PdfSafeColors {
  const colors: PdfSafeColors = {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    color: "#0f172a"
  };

  if (className.includes("bg-slate-950")) {
    colors.backgroundColor = "#0f172a";
  } else if (className.includes("bg-slate-200")) {
    colors.backgroundColor = "#e2e8f0";
  } else if (className.includes("bg-slate-100") || className.includes("bg-slate-50")) {
    colors.backgroundColor = "#f8fafc";
  } else if (className.includes("bg-red-50")) {
    colors.backgroundColor = "#fef2f2";
  } else if (className.includes("bg-teal-700")) {
    colors.backgroundColor = "#0f766e";
  } else if (className.includes("bg-teal-800")) {
    colors.backgroundColor = "#115e59";
  } else if (className.includes("bg-teal") || className.includes("bg-emerald")) {
    colors.backgroundColor = "#ecfdf5";
  } else if (className.includes("bg-blue")) {
    colors.backgroundColor = "#eff6ff";
  }

  if (className.includes("border-slate-950")) {
    colors.borderColor = "#0f172a";
  } else if (className.includes("border-red-100")) {
    colors.borderColor = "#fee2e2";
  } else if (className.includes("border-red-200")) {
    colors.borderColor = "#fecaca";
  } else if (className.includes("border-teal")) {
    colors.borderColor = "#0f766e";
  }

  if (className.includes("text-white")) {
    colors.color = "#ffffff";
  } else if (className.includes("text-red")) {
    colors.color = "#b91c1c";
  } else if (className.includes("text-teal")) {
    colors.color = "#0f766e";
  } else if (className.includes("text-slate-500") || className.includes("text-slate-400")) {
    colors.color = "#64748b";
  } else if (className.includes("text-slate-600") || className.includes("text-slate-700") || className.includes("text-slate-800")) {
    colors.color = "#334155";
  }

  return colors;
}

function sanitizePdfExportClone(clonedDocument: Document): void {
  const root = clonedDocument.querySelector<HTMLElement>('[data-pdf-export-root="true"]');

  if (!root) {
    return;
  }

  root.style.backgroundColor = "#ffffff";
  root.style.color = "#0f172a";
  root.style.borderColor = "#e2e8f0";
  root.style.boxShadow = "none";

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.tagName.toLowerCase() === "img") {
      return;
    }

    const className = element.getAttribute("class") ?? "";
    const safeColors = pdfSafeColorsForClassName(className);

    element.style.color = safeColors.color;
    element.style.backgroundColor = safeColors.backgroundColor;
    element.style.borderColor = safeColors.borderColor;
    element.style.borderTopColor = safeColors.borderColor;
    element.style.borderRightColor = safeColors.borderColor;
    element.style.borderBottomColor = safeColors.borderColor;
    element.style.borderLeftColor = safeColors.borderColor;
    element.style.outlineColor = safeColors.borderColor;
    element.style.boxShadow = "none";
    element.style.textShadow = "none";
    element.style.backgroundImage = "none";
  });
}

export async function downloadElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  await document.fonts?.ready;
  await waitForPdfImages(element);
  const exportOptions = getPdfExportOptions("exact-a4");
  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    onclone: sanitizePdfExportClone
  });
  const layout = calculatePdfImageLayout({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    pageWidthMm: exportOptions.pageWidthMm,
    pageHeightMm: exportOptions.pageHeightMm,
    marginMm: exportOptions.marginMm
  });
  const { breakpointsPx, forcedBreakpointsPx } = collectPdfBreakpoints(element, canvas.height);
  const slices = calculatePdfPageSlices({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    pageWidthMm: exportOptions.pageWidthMm,
    pageHeightMm: exportOptions.pageHeightMm,
    marginMm: exportOptions.marginMm,
    breakpointsPx,
    forcedBreakpointsPx
  });
  const pdf = new jsPDF("p", "mm", "a4");

  slices.forEach((slice, index) => {
    if (index > 0) {
      pdf.addPage();
    }

    const sliceCanvas = createCanvasSlice(canvas, slice.topPx, slice.heightPx);
    const sliceImageData = sliceCanvas.toDataURL("image/jpeg", exportOptions.imageQuality);
    const sliceHeightMm = (sliceCanvas.height * layout.imageWidthMm) / canvas.width;

    pdf.addImage(sliceImageData, "JPEG", layout.marginMm, layout.marginMm, layout.imageWidthMm, sliceHeightMm);
  });

  pdf.save(filename);
}
