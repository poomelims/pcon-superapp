import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  AccordionToggle,
  Button,
  Field,
  StatusFeedback,
  StickyActionBar,
  TextInput
} from "@/app/project-setup/features/shared/ui";

describe("shared interaction primitives", () => {
  it("exposes the expanded state and controlled region on accordion toggles", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AccordionToggle, {
        expanded: false,
        label: "งานวันนี้",
        controls: "daily-work",
        className: "test-hook",
        onClick: () => undefined
      })
    );

    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('aria-controls="daily-work"');
    expect(markup).toContain("งานวันนี้");
    expect(markup).toContain("test-hook");
  });

  it("renders error feedback as a status message", () => {
    const markup = renderToStaticMarkup(
      React.createElement(StatusFeedback, { tone: "error", className: "test-hook" }, "บันทึกไม่สำเร็จ")
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("บันทึกไม่สำเร็จ");
    expect(markup).toContain("test-hook");
  });

  it("keeps sticky action content presentational and status-labeled", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        StickyActionBar,
        { status: "กำลังบันทึก", className: "test-hook" },
        React.createElement("button", { type: "button" }, "บันทึก")
      )
    );

    expect(markup).toContain("กำลังบันทึก");
    expect(markup).toContain("บันทึก");
    expect(markup).toContain("test-hook");
    expect(markup).toContain("env(safe-area-inset-bottom");
  });

  it("keeps field labels and controls readable on first use", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        Field,
        { label: "ชื่อโครงการ" } as React.ComponentProps<typeof Field>,
        React.createElement(TextInput, { value: "บ้านตัวอย่าง", readOnly: true }),
        React.createElement(Button, { type: "button" }, "บันทึก")
      )
    );

    expect(markup).toContain("text-sm font-semibold");
    expect(markup).toContain("text-base text-slate-900");
    expect(markup).toContain("min-h-[var(--pcon-tap-target)]");
  });
});
