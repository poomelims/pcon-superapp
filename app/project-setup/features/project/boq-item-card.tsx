"use client";

import type React from "react";

import { calculateItemTotal, formatCurrency, formatPercent } from "@/lib/project-calculations";
import type { BoqItem } from "@/lib/project-storage";
import { Button, Field, TextInput } from "../shared/ui";
import { numberFromInput } from "../shared/utils";

export function BoqItemCard({
  categoryName,
  item,
  canDelete,
  onChange,
  onDelete
}: {
  categoryName: string;
  item: BoqItem;
  canDelete: boolean;
  onChange: (patch: Partial<BoqItem>) => void;
  onDelete: () => void;
}) {
  return (
    <article
      data-testid="boq-item-card"
      data-boq-category={categoryName}
      data-boq-item-id={item.id}
      className="grid min-w-0 gap-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.75),rgba(255,255,255,0.98))] p-4 md:grid-cols-2 xl:grid-cols-[1.45fr_.55fr_.5fr_.75fr_.75fr_.6fr_auto] xl:items-end"
    >
      <Field label="รายการ">
        <TextInput
          aria-label="รายการ"
          data-testid="boq-item-description"
          value={item.description}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>
      <Field label="จำนวน">
        <TextInput
          aria-label="จำนวน"
          data-testid="boq-item-quantity"
          type="number"
          min={0}
          value={item.quantity}
          onChange={(event) => onChange({ quantity: numberFromInput(event.target.value) })}
        />
      </Field>
      <Field label="หน่วย">
        <TextInput
          aria-label="หน่วย"
          data-testid="boq-item-unit"
          value={item.unit}
          onChange={(event) => onChange({ unit: event.target.value })}
        />
      </Field>
      <Field label="ราคา/หน่วย">
        <TextInput
          aria-label="ราคา/หน่วย"
          data-testid="boq-item-unit-price"
          type="number"
          min={0}
          value={item.unitPrice}
          onChange={(event) => onChange({ unitPrice: numberFromInput(event.target.value) })}
        />
      </Field>
      <div className="grid min-h-11 content-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2" data-testid="boq-item-total">
        <span className="text-xs font-semibold text-slate-500">รวมรายการ</span>
        <span className="text-sm font-black text-slate-950">{formatCurrency(calculateItemTotal(item))}</span>
      </div>
      <Field label="Progress %">
        <TextInput
          aria-label="Progress %"
          data-testid="boq-item-progress"
          type="number"
          min={0}
          max={100}
          value={item.progress}
          onChange={(event) => onChange({ progress: numberFromInput(event.target.value) })}
        />
        <span className="text-xs font-black text-emerald-700" data-testid="boq-item-progress-value">
          {formatPercent(item.progress)}
        </span>
      </Field>
      {canDelete ? (
        <Button type="button" variant="danger" data-testid="boq-item-delete" onClick={onDelete}>
          ลบรายการ
        </Button>
      ) : (
        <div className="grid min-h-11 place-items-center rounded-2xl bg-slate-100 px-3 py-2 text-center text-xs font-bold leading-5 text-slate-500" data-testid="boq-item-delete-permission">
          Admin/Owner ลบได้
        </div>
      )}
    </article>
  );
}
