"use client";

import { Button, StatusFeedback, StickyActionBar } from "../shared/ui";
import { getDailyReportSaveFeedback } from "@/lib/project-control/daily-report-quick-view-model";

export type DailySaveFeedback = ReturnType<typeof getDailyReportSaveFeedback>;

export function DailySaveBar({
  feedback,
  disabled,
  onSave,
  isEditing
}: {
  feedback: DailySaveFeedback;
  disabled: boolean;
  onSave: () => void | Promise<unknown>;
  isEditing: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 xl:hidden">
      <StickyActionBar
        className="pointer-events-auto !static !mx-0 mt-0 rounded-[20px] border border-slate-200 bg-white/96 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.18)]"
        status={undefined}
      >
        <div data-testid="daily-save-bar" data-editing={isEditing ? "true" : "false"} className="grid w-full min-w-0 gap-2">
          <div className={feedback.tone === "success" || feedback.tone === "error" ? "block" : "hidden"}>
            {feedback.tone === "success" || feedback.tone === "error" ? (
              <StatusFeedback tone={feedback.tone} className="px-3 py-2 text-xs">
                {feedback.label}
              </StatusFeedback>
            ) : null}
          </div>
          <Button type="button" onClick={onSave} disabled={disabled} aria-label={feedback.actionLabel} className="w-full rounded-xl bg-emerald-600 py-3 text-base shadow-[0_8px_18px_rgba(5,150,105,0.24)] hover:bg-emerald-700">
            <span aria-hidden="true">▣</span> {feedback.actionLabel}
          </Button>
        </div>
      </StickyActionBar>
    </div>
  );
}
