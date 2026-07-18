"use client";

import { useState } from "react";

import { clampProgress } from "@/lib/project-calculations";
import { TextInput } from "../shared/ui";

export type ProgressPercentInputProps = {
  value: number;
  ariaLabel: string;
  onCommit: (value: number) => void;
};

export function normalizeProgressInputDraft(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return String(Number(digits));
}

export function commitProgressInputDraft(rawValue: string, fallbackValue: number): number {
  const normalized = normalizeProgressInputDraft(rawValue);
  return normalized ? clampProgress(Number(normalized)) : clampProgress(fallbackValue);
}

export function ProgressPercentInput({ value, ariaLabel, onCommit }: ProgressPercentInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const committedValue = clampProgress(value);
  const displayedValue = draft ?? String(committedValue);

  function commit() {
    if (draft === null) {
      return;
    }

    const nextValue = commitProgressInputDraft(draft, committedValue);
    setDraft(null);

    if (nextValue !== committedValue) {
      onCommit(nextValue);
    }
  }

  return (
    <TextInput
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={3}
      aria-label={ariaLabel}
      value={displayedValue}
      onFocus={(event) => {
        setDraft(String(committedValue));
        event.currentTarget.select();
      }}
      onChange={(event) => setDraft(normalizeProgressInputDraft(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
