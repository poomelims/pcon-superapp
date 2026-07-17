import { describe, expect, it } from "vitest";

import {
  filterActiveProjectsForDisplay,
  filterProjectsByCompany,
  filterSuccessProjectsForDisplay,
  sortProjectsForDisplay
} from "@/lib/project-sorting";
import { createProject, type Project } from "@/lib/project-storage";

function project(
  name: string,
  overrides: {
    status?: string;
    startDate?: string;
    dueDate?: string;
    progress?: number;
    updatedAt?: string;
  }
): Project {
  const base = createProject("company-1", name);

  return {
    ...base,
    id: name,
    status: overrides.status ?? "ดำเนินการ",
    timeline: {
      startDate: overrides.startDate ?? "2026-05-01",
      dueDate: overrides.dueDate ?? ""
    },
    boq: [
      {
        id: `${name}-cat`,
        name: "BOQ",
        items: [
          {
            id: `${name}-item`,
            description: name,
            quantity: 1,
            unit: "งาน",
            unitPrice: 100,
            progress: overrides.progress ?? 0
          }
        ]
      }
    ],
    updatedAt: overrides.updatedAt ?? "2026-05-01T00:00:00.000Z"
  };
}

describe("project display sorting", () => {
  it("returns only projects belonging to the active company", () => {
    const first = createProject("company-a", "A");
    const second = createProject("company-b", "B");

    expect(filterProjectsByCompany([first, second], "company-a")).toEqual([first]);
  });

  it("prioritizes higher progress, earlier start date, then keeps not-started projects at the bottom", () => {
    const sorted = sortProjectsForDisplay(
      [
        project("not-started-high-progress", { status: "รอเริ่มงาน", startDate: "2026-05-01", progress: 99 }),
        project("future-start-high-progress", { startDate: "2026-05-30", progress: 98 }),
        project("highest-progress", { startDate: "2026-05-20", progress: 90 }),
        project("same-progress-earlier-start", { startDate: "2026-05-01", progress: 80 }),
        project("same-progress-later-start", { startDate: "2026-05-10", progress: 80 }),
        project("low-progress", { startDate: "2026-05-01", progress: 10 })
      ],
      "2026-05-24"
    );

    expect(sorted.map((entry) => entry.name)).toEqual([
      "highest-progress",
      "same-progress-earlier-start",
      "same-progress-later-start",
      "low-progress",
      "future-start-high-progress",
      "not-started-high-progress"
    ]);
  });

  it("splits active projects from success projects before rendering project lists", () => {
    const projects = [
      project("done-project", { status: "จบงานแล้ว", progress: 100 }),
      project("active-project", { status: "ดำเนินการ", progress: 50 }),
      project("waiting-project", { status: "รอเริ่มงาน", progress: 0 })
    ];

    expect(filterActiveProjectsForDisplay(projects, "2026-05-24").map((entry) => entry.name)).toEqual([
      "active-project",
      "waiting-project"
    ]);
    expect(filterSuccessProjectsForDisplay(projects).map((entry) => entry.name)).toEqual(["done-project"]);
  });
});
