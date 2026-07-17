import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BoqItem } from "@/lib/project-storage";
import { formatCurrency } from "@/lib/project-calculations";
import { BoqItemCard } from "@/app/project-setup/features/project/boq-item-card";

const item: BoqItem = {
  id: "item-1",
  description: "คอนกรีตฐานราก",
  quantity: 2,
  unit: "ลบ.ม.",
  unitPrice: 1000,
  progress: 50
};

describe("BoqItemCard", () => {
  it("renders readable BOQ fields, item total, progress, and delete action", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BoqItemCard, {
        categoryName: "งานโครงสร้าง",
        item,
        canDelete: true,
        onChange: () => undefined,
        onDelete: () => undefined
      })
    );

    expect(markup).toContain('data-testid="boq-item-card"');
    expect(markup).toContain('aria-label="รายการ"');
    expect(markup).toContain('aria-label="จำนวน"');
    expect(markup).toContain('aria-label="หน่วย"');
    expect(markup).toContain('aria-label="ราคา/หน่วย"');
    expect(markup).toContain('aria-label="Progress %"');
    expect(markup).toContain("คอนกรีตฐานราก");
    expect(markup).toContain(formatCurrency(2000));
    expect(markup).toContain("50.0%");
    expect(markup).toContain("ลบรายการ");
  });

  it("keeps the delete explanation while hiding the destructive action for non-admin roles", () => {
    const markup = renderToStaticMarkup(
      React.createElement(BoqItemCard, {
        categoryName: "งานโครงสร้าง",
        item,
        canDelete: false,
        onChange: () => undefined,
        onDelete: () => undefined
      })
    );

    expect(markup).not.toContain('data-testid="boq-item-delete"');
    expect(markup).toContain('data-testid="boq-item-delete-permission"');
    expect(markup).toContain("Admin/Owner ลบได้");
  });
});
