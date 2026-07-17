import { describe, expect, it, vi } from "vitest";

import {
  createCloudSyncPayload,
  createBlankDailyReportDraft,
  createBuyinEntry,
  createCloudSafeSyncData,
  createCarryForwardDailyReport,
  createCrew,
  createLaborExpense,
  createProject,
  exportProjectControlJson,
  importProjectControlJson,
  loadDataFromSupabaseWithClient,
  pruneDailyReportMediaByRetention,
  syncDataToSupabaseWithClient,
  todayString,
  updateActiveCompanyName,
  type DailyReport,
  type ProjectControlData
} from "@/lib/project-storage";

const project = createProject("company-1", "บ้านตัวอย่าง");

function buildSyncData(overrides: Partial<ProjectControlData> = {}): ProjectControlData {
  return {
    companies: [
      {
        id: "company-1",
        name: "บริษัทของฉัน",
        role: "owner",
        createdAt: "2026-05-09T00:00:00.000Z",
        updatedAt: "2026-05-09T00:00:00.000Z"
      }
    ],
    activeCompanyId: "company-1",
    projects: [project],
    activeProjectId: project.id,
    dailyReports: [buildPriorReport()],
    crews: [],
    laborExpenses: [],
    buyinEntries: [],
    ...overrides
  };
}

function buildProjectIntegrityClient(options: { firstProjectLookupIds?: string[]; secondProjectLookupIds?: string[] }) {
  const calls: string[] = [];
  let projectLookupCount = 0;
  const dailyReportsUpsert = async () => {
    calls.push("daily_reports.upsert");
    return { data: [], error: null };
  };
  const projectsUpsert = async () => {
    calls.push("projects.upsert");
    return { data: [], error: null };
  };
  const projectLookup = {
    select: () => ({
      eq: () => ({
        in: async () => {
          calls.push("projects.lookup");
          projectLookupCount += 1;
          const ids = projectLookupCount === 1 ? (options.firstProjectLookupIds ?? []) : (options.secondProjectLookupIds ?? options.firstProjectLookupIds ?? []);

          return { data: ids.map((id) => ({ id })), error: null };
        }
      })
    })
  };
  const deleteQuery = {
    eq: () => Promise.resolve({ data: [], error: null })
  };

  const client = {
    from: (table: string) => {
      if (table === "companies") {
        return {
          upsert: async () => ({ data: [], error: null })
        };
      }

      if (table === "projects") {
        return {
          upsert: projectsUpsert,
          delete: () => deleteQuery,
          select: projectLookup.select
        };
      }

      if (table === "daily_reports") {
        return {
          delete: () => deleteQuery,
          upsert: dailyReportsUpsert
        };
      }

      return {
        delete: () => deleteQuery,
        upsert: async () => ({ data: [], error: null })
      };
    }
  };

  return { client, calls };
}

function buildPriorReport(): DailyReport {
  return {
    id: "report-yesterday",
    companyId: project.companyId,
    projectId: project.id,
    reportDate: "2026-05-09",
    preparedBy: "ภูมิใจ",
    preparedByPhone: "080-123-4567",
    summary: "งานเดินต่อจากเมื่อวาน",
    workItems: [],
    completedWork: "เทพื้นชั้นล่าง",
    ongoingWork: "ติดตั้งระบบไฟ",
    problems: "1. รอวัสดุ 2. พื้นที่หน้างานแคบ",
    materials: "เหล็ก, ปูน",
    nextPlan: "เริ่มงานฝ้า",
    customerNote: "แจ้งความคืบหน้าแล้ว",
    internalNote: "ช่างต้องเข้า 8 โมง",
    workers: [
      {
        id: "worker-1",
        name: "ทีมช่าง A",
        trade: "ไฟฟ้า",
        count: 3,
        startTime: "08:00",
        endTime: "17:00",
        note: "ทำต่อเนื่อง",
        taskTitle: "เดินสายไฟชั้น 1",
        taskStatus: "ดำเนินการ"
      }
    ],
    progressUpdates: [
      {
        id: "progress-1",
        categoryId: "cat-1",
        itemId: "item-1",
        title: "งานไฟฟ้า",
        previousProgress: 30,
        newProgress: 60,
        note: "เดินหน้าได้ตามแผน"
      }
    ],
    problemIssues: [
      {
        id: "issue-1",
        title: "วัสดุเข้าไม่ครบ",
        detail: "สายไฟยังมาไม่ครบตามแผน",
        photos: [
          {
            id: "issue-photo-1",
            name: "issue-1.jpg",
            dataUrl: "data:image/jpeg;base64,aaa"
          }
        ]
      }
    ],
    photos: [
      {
        id: "site-photo-1",
        name: "site-1.jpg",
        dataUrl: "data:image/jpeg;base64,bbb"
      }
    ],
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T10:00:00.000Z"
  };
}

describe("project storage daily report compatibility", () => {
  it("normalizes old imports without HR arrays to empty crew and labor expense collections", () => {
    const raw = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: []
    } as unknown as ProjectControlData;

    const imported = importProjectControlJson(JSON.stringify(raw));

    expect(imported.crews).toEqual([]);
    expect(imported.laborExpenses).toEqual([]);
  });

  it("exports and imports HR crews, labor expenses, and Daily Report crew links", () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีมคุณสมชาย",
      nationalId: "1101700234567",
      workTypes: ["ไฟฟ้า", "ประปา"]
    });
    const laborExpense = createLaborExpense("company-1", {
      crewId: crew.id,
      projectId: project.id,
      expenseDate: "2026-05-10",
      workType: "ไฟฟ้า",
      description: "ค่าแรงเดินสายไฟ",
      amount: 12500
    });
    const report = {
      ...buildPriorReport(),
      workers: [
        {
          ...buildPriorReport().workers[0],
          crewId: crew.id
        }
      ]
    };
    const exported = exportProjectControlJson(
      buildSyncData({
        dailyReports: [report],
        crews: [crew],
        laborExpenses: [laborExpense]
      })
    );
    const imported = importProjectControlJson(exported);

    expect(imported.crews[0]).toMatchObject({
      leaderName: "ทีมคุณสมชาย",
      nationalId: "1101700234567",
      workTypes: ["ไฟฟ้า", "ประปา"]
    });
    expect(imported.laborExpenses[0]).toMatchObject({
      crewId: crew.id,
      projectId: project.id,
      amount: 12500
    });
    expect(imported.laborExpenses[0].amount).toBe(12500);
    expect(imported.dailyReports[0].workers[0].crewId).toBe(crew.id);
  });

  it("normalizes negative labor expense amounts to zero", () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีมคุณสมชาย",
      nationalId: "1101700234567",
      workTypes: ["ไฟฟ้า"]
    });
    const raw = buildSyncData({
      crews: [crew],
      laborExpenses: [
        {
          id: "expense-negative",
          companyId: "company-1",
          crewId: crew.id,
          projectId: project.id,
          expenseDate: "2026-05-10",
          workType: "ไฟฟ้า",
          description: "ค่าแรงติดลบจากไฟล์เก่า",
          amount: -5000,
          note: "",
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z"
        }
      ]
    });

    const imported = importProjectControlJson(JSON.stringify(raw));

    expect(imported.laborExpenses[0].amount).toBe(0);
  });

  it("keeps decimal baht values when creating HR labor expenses", () => {
    const laborExpense = createLaborExpense("company-1", {
      crewId: "crew-1",
      projectId: project.id,
      expenseDate: "2026-05-10",
      workType: "ไฟฟ้า",
      description: "ค่าแรงทศนิยม",
      amount: 745.36
    });

    expect(laborExpense.amount).toBe(745.36);
  });

  it("normalizes unsafe BOQ, worker, and daily progress numbers from old imports", () => {
    const rawProject = {
      ...project,
      boq: [
        {
          id: "cat-negative",
          name: "งานเก่า",
          items: [
            {
              id: "item-negative",
              description: "รายการเก่า",
              quantity: -4,
              unit: "งาน",
              unitPrice: -2500,
              progress: 180
            }
          ]
        }
      ]
    };
    const rawReport = {
      ...buildPriorReport(),
      workers: [{ ...buildPriorReport().workers[0], count: -3 }],
      progressUpdates: [{ ...buildPriorReport().progressUpdates[0], previousProgress: -20, newProgress: 150 }]
    };

    const imported = importProjectControlJson(JSON.stringify(buildSyncData({ projects: [rawProject], dailyReports: [rawReport] })));

    expect(imported.projects[0].boq[0].items[0]).toMatchObject({
      quantity: 0,
      unitPrice: 0,
      progress: 100
    });
    expect(imported.dailyReports[0].workers[0].count).toBe(0);
    expect(imported.dailyReports[0].progressUpdates[0]).toMatchObject({
      previousProgress: 0,
      newProgress: 100
    });
  });

  it("updates the active company name without changing project data", () => {
    const data = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [],
      crews: [],
      laborExpenses: [],
      buyinEntries: []
    } satisfies ProjectControlData;

    const updated = updateActiveCompanyName(data, "PCON Construction");

    expect(updated.companies[0].name).toBe("PCON Construction");
    expect(updated.projects).toBe(data.projects);
    expect("updatedAt" in updated).toBe(false);
    expect(updated.companies[0].updatedAt).not.toBe(data.companies[0].updatedAt);
  });

  it("keeps project cover images through import normalization", () => {
    const raw = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [
        {
          ...project,
          coverImage: {
            id: "cover-1",
            name: "cover.jpg",
            dataUrl: "data:image/jpeg;base64,cover"
          }
        }
      ],
      activeProjectId: project.id,
      dailyReports: []
    } as unknown as ProjectControlData;

    const imported = importProjectControlJson(JSON.stringify(raw));

    expect(imported.projects[0].coverImage).toMatchObject({
      id: "cover-1",
      name: "cover.jpg",
      dataUrl: "data:image/jpeg;base64,cover"
    });
  });

  it("uses Bangkok-local calendar days for daily report defaults", () => {
    expect(todayString(new Date("2026-05-09T16:30:00.000Z"))).toBe("2026-05-09");
    expect(todayString(new Date("2026-05-09T17:30:00.000Z"))).toBe("2026-05-10");
  });

  it("creates a blank daily draft with one default worker for fast entry", () => {
    const nextReport = createBlankDailyReportDraft(project);

    expect(nextReport.workers).toHaveLength(1);
    expect(nextReport.workers[0]).toMatchObject({
      trade: "ทั่วไป",
      count: 1,
      startTime: "08:00",
      endTime: "17:00",
      taskStatus: "ดำเนินการ"
    });
  });

  it("creates a carry-forward report for today and clears photos", () => {
    const priorReport = buildPriorReport();

    const nextReport = createCarryForwardDailyReport(project, priorReport, "2026-05-10");

    expect(nextReport.id).not.toBe(priorReport.id);
    expect(nextReport.reportDate).toBe("2026-05-10");
    expect(nextReport.summary).toBe(priorReport.summary);
    expect(nextReport.workers).toEqual(priorReport.workers);
    expect(nextReport.progressUpdates).toEqual(priorReport.progressUpdates);
    expect(nextReport.problemIssues).toHaveLength(1);
    expect(nextReport.problemIssues[0].title).toBe("วัสดุเข้าไม่ครบ");
    expect(nextReport.problemIssues[0].photos).toEqual([]);
    expect(nextReport.photos).toEqual([]);
  });

  it("migrates legacy problems text into a structured problem issue and worker defaults", () => {
    const raw = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [
        {
          ...buildPriorReport(),
          workers: [
            {
              id: "worker-legacy",
              name: "ทีมช่าง B",
              trade: "ทั่วไป",
              count: 2,
              startTime: "08:00",
              endTime: "17:00",
              note: ""
            }
          ],
          problemIssues: undefined as never,
          photos: [],
          problems: "น้ำซึมบริเวณผนังหลังห้องน้ำ"
        }
      ]
    } as unknown as ProjectControlData;

    const imported = importProjectControlJson(JSON.stringify(raw));
    const report = imported.dailyReports[0];

    expect(report.problemIssues).toHaveLength(1);
    expect(report.problemIssues[0].detail).toContain("น้ำซึม");
    expect(report.workers[0].taskTitle).toBe("");
    expect(report.workers[0].taskStatus).toBe("ดำเนินการ");
  });

  it("keeps old reports but strips photos after 3 days", () => {
    const raw = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [buildPriorReport()]
    } as unknown as ProjectControlData;

    const imported = importProjectControlJson(JSON.stringify(raw), "2026-05-13");
    const report = imported.dailyReports[0];

    expect(report.summary).toBe("งานเดินต่อจากเมื่อวาน");
    expect(report.photos).toEqual([]);
    expect(report.problemIssues[0].photos).toEqual([]);
  });

  it("prunes old daily report photos while keeping all text fields", () => {
    const report = {
      ...buildPriorReport(),
      reportDate: "2026-05-06",
      summary: "ข้อความต้องอยู่ต่อ",
      photos: [{ id: "old-photo", name: "old.jpg", dataUrl: "data:image/jpeg;base64,old" }],
      problemIssues: [
        {
          id: "old-issue",
          title: "ปัญหาเดิม",
          detail: "รายละเอียดต้องอยู่ต่อ",
          photos: [{ id: "old-issue-photo", name: "old-issue.jpg", dataUrl: "data:image/jpeg;base64,old-issue" }]
        }
      ]
    };
    const data = {
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [report],
      crews: [],
      laborExpenses: [],
      buyinEntries: []
    } satisfies ProjectControlData;

    const pruned = pruneDailyReportMediaByRetention(data, "2026-05-10");

    expect(pruned.dailyReports[0].summary).toBe("ข้อความต้องอยู่ต่อ");
    expect(pruned.dailyReports[0].problemIssues[0].detail).toBe("รายละเอียดต้องอยู่ต่อ");
    expect(pruned.dailyReports[0].photos).toEqual([]);
    expect(pruned.dailyReports[0].problemIssues[0].photos).toEqual([]);
  });

  it("keeps old daily report photos out of cloud payloads", () => {
    const report = {
      ...buildPriorReport(),
      reportDate: "2026-05-06",
      photos: [{ id: "old-photo", name: "old.jpg", dataUrl: "data:image/jpeg;base64,old" }]
    };
    const payload = createCloudSyncPayload(
      {
        companies: [
          {
            id: "company-1",
            name: "บริษัทของฉัน",
            role: "owner",
            createdAt: "2026-05-09T00:00:00.000Z",
            updatedAt: "2026-05-09T00:00:00.000Z"
          }
        ],
        activeCompanyId: "company-1",
        projects: [project],
        activeProjectId: project.id,
        dailyReports: [report],
        crews: [],
        laborExpenses: [],
        buyinEntries: []
      },
      "company-1",
      "2026-05-10"
    );

    expect(payload.dailyReports[0].summary).toBe("งานเดินต่อจากเมื่อวาน");
    expect(payload.dailyReports[0].photos).toEqual([]);
  });

  it("keeps cloud sync payload image-light so large local photos do not exceed serverless limits", () => {
    const report = {
      ...buildPriorReport(),
      reportDate: "2026-05-10",
      problemIssues: [
        {
          id: "issue-1",
          title: "วัสดุเข้าไม่ครบ",
          detail: "สายไฟยังมาไม่ครบ",
          photos: [{ id: "issue-photo-1", name: "issue.jpg", dataUrl: `data:image/jpeg;base64,${"a".repeat(5000)}` }]
        }
      ],
      photos: [{ id: "site-photo-1", name: "site.jpg", dataUrl: `data:image/jpeg;base64,${"b".repeat(5000)}` }]
    };
    const projectWithCover = {
      ...project,
      coverImage: {
        id: "cover-1",
        name: "cover.jpg",
        dataUrl: `data:image/jpeg;base64,${"c".repeat(5000)}`
      }
    };

    const payload = createCloudSyncPayload(
      {
        companies: [
          {
            id: "company-1",
            name: "บริษัทของฉัน",
            role: "owner",
            createdAt: "2026-05-09T00:00:00.000Z",
            updatedAt: "2026-05-09T00:00:00.000Z"
          }
        ],
        activeCompanyId: "company-1",
        projects: [projectWithCover],
        activeProjectId: projectWithCover.id,
        dailyReports: [report],
        crews: [],
        laborExpenses: [],
        buyinEntries: []
      },
      "company-1",
      "2026-05-10"
    );

    expect(payload.projects[0].cover_image).toBeNull();
    expect(payload.dailyReports[0].photos).toEqual([]);
    expect(payload.dailyReports[0].problem_issues?.[0]).toMatchObject({
      id: "issue-1",
      title: "วัสดุเข้าไม่ครบ",
      detail: "สายไฟยังมาไม่ครบ",
      photos: []
    });
    expect(JSON.stringify(payload)).not.toContain("data:image/jpeg;base64");
  });

  it("creates cloud-safe sync data without mutating local project photos", () => {
    const report = {
      ...buildPriorReport(),
      photos: [{ id: "site-photo-1", name: "site.jpg", dataUrl: "data:image/jpeg;base64,site" }],
      problemIssues: [
        {
          id: "issue-1",
          title: "ปัญหา",
          detail: "รายละเอียด",
          photos: [{ id: "issue-photo-1", name: "issue.jpg", dataUrl: "data:image/jpeg;base64,issue" }]
        }
      ]
    };
    const projectWithCover = {
      ...project,
      coverImage: { id: "cover-1", name: "cover.jpg", dataUrl: "data:image/jpeg;base64,cover" }
    };
    const data = buildSyncData({
      projects: [projectWithCover],
      dailyReports: [report]
    });

    const cloudSafe = createCloudSafeSyncData(data);

    expect(cloudSafe.projects[0].coverImage).toBeNull();
    expect(cloudSafe.dailyReports[0].photos).toEqual([]);
    expect(cloudSafe.dailyReports[0].problemIssues[0].photos).toEqual([]);
    expect(data.projects[0].coverImage?.dataUrl).toContain("data:image/jpeg;base64,cover");
    expect(data.dailyReports[0].photos[0].dataUrl).toContain("data:image/jpeg;base64,site");
    expect(JSON.stringify(cloudSafe)).not.toContain("data:image/jpeg;base64");
  });

  it("creates a cloud payload scoped to the active company with flattened BOQ and report rows", () => {
    const report = buildPriorReport();
    const localProject = {
      ...project,
      boq: [
        {
          id: "cat-1",
          name: "งานโครงสร้าง",
          items: [
            {
              id: "item-1",
              description: "ฐานราก",
              quantity: 10,
              unit: "ตร.ม.",
              unitPrice: 1000,
              progress: 60
            }
          ]
        }
      ]
    };

    const payload = createCloudSyncPayload({
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [localProject],
      activeProjectId: localProject.id,
      dailyReports: [report],
      crews: [],
      laborExpenses: [],
      buyinEntries: []
    });

    expect(payload.company.id).toBe("company-1");
    expect(payload.projects).toHaveLength(1);
    expect(payload.boqCategories[0].company_id).toBe("company-1");
    expect(payload.boqItems[0].project_id).toBe(localProject.id);
    expect(payload.boqItems[0].name).toBe("ฐานราก");
    expect(payload.dailyReports[0].prepared_by).toBe("ภูมิใจ");
    expect(payload.dailyReports[0].prepared_by_phone).toBe("080-123-4567");
    expect(payload.dailyReportWorkers[0].report_id).toBe(report.id);
    expect(payload.dailyReportWorkers[0]).toHaveProperty("crew_id");
    expect(payload.dailyReportProgressUpdates[0].company_id).toBe("company-1");
  });

  it("drops a dangling Daily Report crew reference from the cloud payload", () => {
    const report = buildPriorReport();
    report.workers = report.workers.map((worker) => ({
      ...worker,
      crewId: "crew-that-no-longer-exists"
    }));

    const payload = createCloudSyncPayload(buildSyncData({ dailyReports: [report], crews: [] }));

    expect(payload.dailyReportWorkers[0].crew_id).toBeNull();
  });

  it("keeps daily report workers and progress updates unique for one Supabase upsert batch", () => {
    const firstReport = buildPriorReport();
    const secondReport = {
      ...buildPriorReport(),
      id: "report-today",
      reportDate: "2026-05-10",
      workers: [
        {
          ...buildPriorReport().workers[0],
          name: "ทีมช่าง B"
        }
      ],
      progressUpdates: [
        {
          ...buildPriorReport().progressUpdates[0],
          title: "งานไฟฟ้า วันนี้"
        }
      ]
    } satisfies DailyReport;

    const payload = createCloudSyncPayload({
      companies: [
        {
          id: "company-1",
          name: "บริษัทของฉัน",
          role: "owner",
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z"
        }
      ],
      activeCompanyId: "company-1",
      projects: [project],
      activeProjectId: project.id,
      dailyReports: [firstReport, secondReport],
      crews: [],
      laborExpenses: [],
      buyinEntries: []
    });

    expect(payload.dailyReportWorkers).toHaveLength(2);
    expect(new Set(payload.dailyReportWorkers.map((worker) => worker.id))).toHaveLength(2);
    expect(payload.dailyReportWorkers.map((worker) => worker.report_id)).toEqual(["report-yesterday", "report-today"]);
    expect(payload.dailyReportProgressUpdates).toHaveLength(2);
    expect(new Set(payload.dailyReportProgressUpdates.map((update) => update.id))).toHaveLength(2);
    expect(payload.dailyReportProgressUpdates.map((update) => update.report_id)).toEqual(["report-yesterday", "report-today"]);
  });

  it("adds HR crews and labor expenses to full-company cloud payloads", () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีมคุณสมชาย",
      nationalId: "1-1017-00234-56-7",
      workTypes: ["ไฟฟ้า"]
    });
    const expense = createLaborExpense("company-1", {
      crewId: crew.id,
      projectId: project.id,
      amount: 2500,
      expenseDate: "2026-05-12"
    });

    const payload = createCloudSyncPayload(buildSyncData({ crews: [crew], laborExpenses: [expense] })) as ReturnType<typeof createCloudSyncPayload> & {
      hrCrews?: Array<{ id: string; company_id: string; national_id: string; work_types: string[] }>;
      hrLaborExpenses?: Array<{ id: string; company_id: string; crew_id: string; amount: number }>;
    };

    expect(payload.hrCrews).toHaveLength(1);
    expect(payload.hrCrews?.[0]).toMatchObject({
      id: crew.id,
      company_id: "company-1",
      national_id: "1-1017-00234-56-7",
      work_types: ["ไฟฟ้า"]
    });
    expect(payload.hrLaborExpenses).toHaveLength(1);
    expect(payload.hrLaborExpenses?.[0]).toMatchObject({
      id: expense.id,
      company_id: "company-1",
      crew_id: crew.id,
      amount: 2500
    });
  });

  it("syncs HR before labor expenses and skips HR for project-scoped members", async () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีมคุณสมชาย",
      nationalId: "1101700234567",
      workTypes: ["ไฟฟ้า"]
    });
    const expense = createLaborExpense("company-1", {
      crewId: crew.id,
      projectId: project.id,
      amount: 2500,
      expenseDate: "2026-05-12"
    });
    const calls: string[] = [];
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            upsert: async () => {
              calls.push("projects.upsert");
              return { data: [], error: null };
            },
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            delete: () => ({ eq: async () => ({ data: [], error: null }) })
          };
        }

        return {
          upsert: async () => {
            calls.push(`${table}.upsert`);
            return { data: [], error: null };
          },
          delete: () => ({ eq: async () => ({ data: [], error: null }) })
        };
      }
    };

    const fullPayload = await syncDataToSupabaseWithClient(client as never, buildSyncData({ crews: [crew], laborExpenses: [expense] }));
    expect(calls.indexOf("hr_crews.upsert")).toBeGreaterThan(-1);
    expect(calls.indexOf("hr_labor_expenses.upsert")).toBeGreaterThan(calls.indexOf("hr_crews.upsert"));
    expect((fullPayload as typeof fullPayload & { diagnostics?: { counts: { hrCrews?: number; hrLaborExpenses?: number } } }).diagnostics?.counts.hrCrews).toBe(1);
    expect((fullPayload as typeof fullPayload & { diagnostics?: { counts: { hrCrews?: number; hrLaborExpenses?: number } } }).diagnostics?.counts.hrLaborExpenses).toBe(1);

    calls.length = 0;
    await syncDataToSupabaseWithClient(client as never, buildSyncData({ crews: [crew], laborExpenses: [expense] }), {
      allowedProjectIds: [project.id],
      canDeleteMissingRows: false
    });

    expect(calls).not.toContain("hr_crews.upsert");
    expect(calls).not.toContain("hr_labor_expenses.upsert");

    calls.length = 0;
    const scopedHrPayload = await syncDataToSupabaseWithClient(client as never, buildSyncData({ crews: [crew], laborExpenses: [expense] }), {
      allowedProjectIds: [project.id],
      canDeleteMissingRows: false,
      includeCompanyHr: true
    });

    expect(calls).toContain("hr_crews.upsert");
    expect(calls).toContain("hr_labor_expenses.upsert");
    expect((scopedHrPayload as typeof scopedHrPayload & { diagnostics?: { counts: { hrCrews?: number; hrLaborExpenses?: number } } }).diagnostics?.counts.hrCrews).toBe(1);
    expect((scopedHrPayload as typeof scopedHrPayload & { diagnostics?: { counts: { hrCrews?: number; hrLaborExpenses?: number } } }).diagnostics?.counts.hrLaborExpenses).toBe(1);
  });

  it("does not send HR crew references in a project-scoped Daily Report sync without HR permission", async () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีมช่างอ้างอิง",
      nationalId: "1101700234567",
      workTypes: ["ทั่วไป"]
    });
    const report = buildPriorReport();
    report.workers = report.workers.map((worker) => ({ ...worker, crewId: crew.id }));
    let syncedWorkers: Array<{ crew_id: string | null }> = [];
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            upsert: async () => ({ data: [], error: null }),
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            delete: () => ({ eq: async () => ({ data: [], error: null }) })
          };
        }

        return {
          upsert: async (rows: Array<{ crew_id: string | null }>) => {
            if (table === "daily_report_workers") {
              syncedWorkers = rows;
            }
            return { data: [], error: null };
          },
          delete: () => ({ eq: async () => ({ data: [], error: null }) })
        };
      }
    };

    await syncDataToSupabaseWithClient(client as never, buildSyncData({ dailyReports: [report], crews: [crew] }), {
      allowedProjectIds: [project.id],
      canDeleteMissingRows: false,
      includeCompanyHr: false
    });

    expect(syncedWorkers).toHaveLength(1);
    expect(syncedWorkers[0].crew_id).toBeNull();
  });

  it("allows HR-only cloud sync for HR users without assigned projects and keeps it upsert-only", async () => {
    const crew = createCrew("company-1", {
      leaderName: "ทีม HR",
      nationalId: "1101700234567",
      workTypes: ["ทั่วไป"]
    });
    const calls: string[] = [];
    const client = {
      from: (table: string) => ({
        upsert: async () => {
          calls.push(`${table}.upsert`);
          return { data: [], error: null };
        },
        delete: () => ({
          eq: async () => {
            calls.push(`${table}.delete`);
            return { data: [], error: null };
          }
        })
      })
    };

    const payload = await syncDataToSupabaseWithClient(client as never, buildSyncData({ projects: [], activeProjectId: "", crews: [crew] }), {
      allowedProjectIds: [],
      canDeleteMissingRows: false,
      includeCompanyHr: true
    });

    expect(calls).toEqual(["hr_crews.upsert"]);
    expect(payload.diagnostics?.mode).toBe("upsert-only");
    expect(payload.diagnostics?.counts.hrCrews).toBe(1);
  });

  it("verifies parent projects and retries missing project rows before saving daily reports to cloud", async () => {
    const { client, calls } = buildProjectIntegrityClient({
      firstProjectLookupIds: [],
      secondProjectLookupIds: [project.id]
    });

    await syncDataToSupabaseWithClient(client as never, buildSyncData());

    expect(calls).toEqual([
      "projects.upsert",
      "projects.lookup",
      "projects.upsert",
      "projects.lookup",
      "daily_reports.upsert"
    ]);
  });

  it("does not delete missing cloud rows when syncing as a non-admin member", async () => {
    const calls: string[] = [];
    const deleteQuery = {
      eq: () => {
        calls.push("delete.eq");
        return Promise.resolve({ data: [], error: null });
      }
    };
    const projectLookup = {
      select: () => ({
        eq: () => ({
          in: async () => ({ data: [{ id: project.id }], error: null })
        })
      })
    };
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            ...projectLookup,
            delete: () => deleteQuery,
            upsert: async () => {
              calls.push("projects.upsert");
              return { data: [], error: null };
            }
          };
        }

        return {
          delete: () => deleteQuery,
          upsert: async () => {
            calls.push(`${table}.upsert`);
            return { data: [], error: null };
          }
        };
      }
    };

    const payload = await syncDataToSupabaseWithClient(client as never, buildSyncData(), {
      allowedProjectIds: [project.id],
      canDeleteMissingRows: false
    });

    expect(calls).toContain("projects.upsert");
    expect(calls).not.toContain("delete.eq");
    expect(payload.diagnostics?.canDeleteMissingRows).toBe(false);
    expect(payload.diagnostics?.skippedDeleteTables).toBeGreaterThan(0);
  });

  it("keeps project and BOQ writes out of a Daily Report-only member sync", async () => {
    const calls: string[] = [];
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            upsert: async () => {
              calls.push("projects.upsert");
              return { data: [], error: null };
            },
            delete: () => ({ eq: async () => ({ data: [], error: null }) })
          };
        }

        return {
          upsert: async () => {
            calls.push(`${table}.upsert`);
            return { data: [], error: null };
          },
          delete: () => ({ eq: async () => ({ data: [], error: null }) })
        };
      }
    };

    const projectWithBoq = {
      ...project,
      boq: [{ id: "category-1", name: "งานโครงสร้าง", items: [{ id: "item-1", description: "ฐานราก", quantity: 1, unit: "งาน", unitPrice: 100, progress: 10 }] }]
    };

    await syncDataToSupabaseWithClient(client as never, buildSyncData({ projects: [projectWithBoq] }), {
      allowedProjectIds: [project.id],
      allowedSections: ["daily_report"],
      canDeleteMissingRows: false,
      includeCompanyHr: false
    });

    expect(calls).not.toContain("projects.upsert");
    expect(calls).not.toContain("boq_categories.upsert");
    expect(calls).not.toContain("boq_items.upsert");
    expect(calls).toContain("daily_reports.upsert");
  });

  it("stops before daily report upsert with a friendly error when the parent project is still missing", async () => {
    const { client, calls } = buildProjectIntegrityClient({
      firstProjectLookupIds: [],
      secondProjectLookupIds: []
    });

    await expect(syncDataToSupabaseWithClient(client as never, buildSyncData())).rejects.toThrow(
      "บันทึก Daily Report ไป Cloud ไม่สำเร็จ เพราะยังไม่พบ Project หลักบน Cloud"
    );

    expect(calls).toEqual(["projects.upsert", "projects.lookup", "projects.upsert", "projects.lookup"]);
    expect(calls).not.toContain("daily_reports.upsert");
  });

  it("retries a transient project upsert before continuing the cloud sync", async () => {
    let projectUpsertAttempts = 0;
    const deleteQuery = {
      eq: () => Promise.resolve({ data: [], error: null })
    };
    const client = {
      from: (table: string) => {
        if (table === "companies") {
          return { upsert: async () => ({ data: [], error: null }) };
        }

        if (table === "projects") {
          return {
            upsert: async () => {
              projectUpsertAttempts += 1;
              return projectUpsertAttempts === 1
                ? { data: null, error: { message: "fetch failed" } }
                : { data: [], error: null };
            },
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            delete: () => deleteQuery
          };
        }

        return {
          upsert: vi.fn(async () => ({ data: [], error: null })),
          delete: () => deleteQuery
        };
      }
    };

    await syncDataToSupabaseWithClient(client as never, buildSyncData());

    expect(projectUpsertAttempts).toBe(2);
  });

  it("rejects a cloud row ID already owned by another company before any upsert", async () => {
    let upsertCount = 0;
    const client = {
      from: (table: string) => ({
        select: () => ({
          in: async () => ({
            data: table === "projects" ? [{ id: project.id, company_id: "company-other" }] : [],
            error: null
          })
        }),
        upsert: async () => {
          upsertCount += 1;
          return { data: [], error: null };
        },
        delete: () => ({ eq: async () => ({ data: [], error: null }) })
      })
    };

    await expect(syncDataToSupabaseWithClient(client as never, buildSyncData())).rejects.toThrow("company อื่น");
    expect(upsertCount).toBe(0);
  });

  it("turns Supabase schema-cache column drift into an actionable migration error", async () => {
    const calls: string[] = [];
    const deleteQuery = {
      eq: () => Promise.resolve({ data: [], error: null })
    };
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            upsert: async () => {
              calls.push("projects.upsert");
              return { data: [], error: null };
            },
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            delete: () => deleteQuery
          };
        }

        if (table === "daily_reports") {
          return {
            upsert: async () => {
              calls.push("daily_reports.upsert");
              return { data: [], error: null };
            },
            delete: () => deleteQuery
          };
        }

        if (table === "daily_report_workers") {
          return {
            upsert: async () => ({
              data: null,
              error: {
                message: "Could not find the 'crew_id' column of 'daily_report_workers' in the schema cache"
              }
            }),
            delete: () => deleteQuery
          };
        }

        return {
          upsert: async () => ({ data: [], error: null }),
          delete: () => deleteQuery
        };
      }
    };

    await expect(syncDataToSupabaseWithClient(client as never, buildSyncData())).rejects.toThrow(
      /Cloud schema ยังไม่ได้อัปเดต: daily_report_workers\.crew_id.*ข้อมูล local ยังปลอดภัย/
    );
    expect(calls).toContain("daily_reports.upsert");
  });

  it("loads cloud data without adding the default local company when no base data is provided", async () => {
    const client = {
      from: (table: string) => {
        if (table === "companies") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "company-1",
                    name: "บริษัทของฉัน",
                    slug: null,
                    owner_user_id: null,
                    created_at: "2026-05-10T00:00:00.000Z",
                    updated_at: "2026-05-10T00:00:00.000Z"
                  },
                  error: null
                })
              })
            })
          };
        }

        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null })
            })
          })
        };
      }
    };

    const loaded = await loadDataFromSupabaseWithClient(client as never, "company-1");

    expect(loaded.companies.map((company) => company.id)).toEqual(["company-1"]);
    expect(loaded.activeCompanyId).toBe("company-1");
  });

  it("retries a transient cloud read before merging loaded data", async () => {
    let projectAttempts = 0;
    const client = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: async () => {
            if (table === "projects") {
              projectAttempts += 1;
              if (projectAttempts === 1) {
                return { data: null, error: { message: "HTTP 503 Service Unavailable" } };
              }
            }

            return { data: [], error: null };
          },
          maybeSingle: async () => ({
            data: {
              id: "company-1",
              name: "บริษัทของฉัน",
              slug: null,
              owner_user_id: null,
              created_at: "2026-05-10T00:00:00.000Z",
              updated_at: "2026-05-10T00:00:00.000Z"
            },
            error: null
          })
        };
        return query;
      }
    };

    await loadDataFromSupabaseWithClient(client as never, "company-1");

    expect(projectAttempts).toBe(2);
  });

  it("loads project site contact fields from cloud and ignores legacy reporter phone rows", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      projects: [
        {
          id: "project-cloud",
          company_id: "company-1",
          name: "Cloud Project",
          status: "ดำเนินการ",
          owner: "",
          team: [],
          note: "",
          cover_image: null,
          customer_name: "ลูกค้า",
          customer_phone: "02-222-3333",
          customer_email: "",
          customer_line_id: "",
          site_address: "ไซต์งาน",
          site_contact: "คุณไซต์",
          main_contract: 0,
          variation_order: 0,
          start_date: "2026-05-10",
          due_date: "",
          created_at: "2026-05-10T00:00:00.000Z",
          updated_at: "2026-05-10T00:00:00.000Z"
        }
      ],
      boq_categories: [],
      boq_items: [],
      daily_reports: [
        {
          id: "report-cloud",
          company_id: "company-1",
          project_id: "project-cloud",
          report_date: "2026-05-28",
          prepared_by: "แต๊ก",
          prepared_by_phone: "099-999-9999",
          summary: "รายงานจาก cloud",
          completed_work: "",
          ongoing_work: "",
          problems: "",
          materials: "",
          next_plan: "",
          customer_note: "",
          internal_note: "",
          problem_issues: [],
          photos: [],
          created_at: "2026-05-28T00:00:00.000Z",
          updated_at: "2026-05-28T00:00:00.000Z"
        }
      ],
      daily_report_workers: [],
      daily_report_progress_updates: [],
      hr_crews: [],
      hr_labor_expenses: [],
      buyin_entries: []
    };
    const client = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: async () => ({ data: rowsByTable[table] ?? [], error: null }),
          maybeSingle: async () => ({
            data: {
              id: "company-1",
              name: "บริษัทของฉัน",
              slug: null,
              owner_user_id: null,
              created_at: "2026-05-10T00:00:00.000Z",
              updated_at: "2026-05-10T00:00:00.000Z"
            },
            error: null
          })
        };
        return query;
      }
    };

    const loaded = await loadDataFromSupabaseWithClient(client as never, "company-1");

    expect(loaded.dailyReports[0]).toMatchObject({
      id: "report-cloud",
      preparedBy: "แต๊ก",
      preparedByPhone: "099-999-9999"
    });
    expect(loaded.projects[0].customer).toMatchObject({
      phone: "02-222-3333",
      siteAddress: "ไซต์งาน",
      siteContact: "คุณไซต์"
    });
  });

  it("loads legacy Daily Report workers after clearing missing optional crew references", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      projects: [{ id: "project-cloud", company_id: "company-1", name: "Cloud Project" }],
      boq_categories: [],
      boq_items: [],
      daily_reports: [
        {
          id: "report-cloud",
          company_id: "company-1",
          project_id: "project-cloud",
          report_date: "2026-05-28",
          problem_issues: [],
          photos: []
        }
      ],
      daily_report_workers: [
        {
          id: "worker-cloud",
          company_id: "company-1",
          project_id: "project-cloud",
          report_id: "report-cloud",
          crew_id: "crew-no-longer-exists",
          name: "ทีมช่างเดิม",
          count: 1,
          task_status: "ดำเนินการ"
        }
      ],
      daily_report_progress_updates: [],
      hr_crews: [],
      hr_labor_expenses: [],
      buyin_entries: []
    };
    const client = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: async () => ({ data: rowsByTable[table] ?? [], error: null }),
          maybeSingle: async () => ({
            data: {
              id: "company-1",
              name: "บริษัทของฉัน",
              slug: null,
              owner_user_id: null,
              created_at: "2026-05-10T00:00:00.000Z",
              updated_at: "2026-05-10T00:00:00.000Z"
            },
            error: null
          })
        };
        return query;
      }
    };

    const loaded = await loadDataFromSupabaseWithClient(client as never, "company-1");

    expect(loaded.dailyReports[0].workers[0]).toMatchObject({
      id: "worker-cloud",
      name: "ทีมช่างเดิม",
      crewId: undefined
    });
  });

  it("rejects malformed cloud child rows before merging them into local data", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      projects: [
        { id: "project-cloud", company_id: "company-1", name: "Cloud Project" },
        { id: "project-other", company_id: "company-1", name: "Other Project" }
      ],
      boq_categories: [],
      boq_items: [],
      daily_reports: [
        {
          id: "report-cloud",
          company_id: "company-1",
          project_id: "project-cloud",
          report_date: "2026-05-28",
          problem_issues: [],
          photos: []
        }
      ],
      daily_report_workers: [
        {
          id: "worker-cloud",
          company_id: "company-1",
          project_id: "project-other",
          report_id: "report-cloud",
          crew_id: null,
          count: 1,
          task_status: "ดำเนินการ"
        }
      ],
      daily_report_progress_updates: [],
      hr_crews: [],
      hr_labor_expenses: [],
      buyin_entries: []
    };
    const client = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: async () => ({ data: rowsByTable[table] ?? [], error: null }),
          maybeSingle: async () => ({
            data: {
              id: "company-1",
              name: "บริษัทของฉัน",
              slug: null,
              owner_user_id: null,
              created_at: "2026-05-10T00:00:00.000Z",
              updated_at: "2026-05-10T00:00:00.000Z"
            },
            error: null
          })
        };
        return query;
      }
    };

    await expect(loadDataFromSupabaseWithClient(client as never, "company-1")).rejects.toThrow("worker อ้างอิง report คนละ project");
  });

  it("loads HR crews and labor expenses from full-company cloud data", async () => {
    const rowsByTable: Record<string, unknown[]> = {
      projects: [],
      boq_categories: [],
      boq_items: [],
      daily_reports: [],
      daily_report_workers: [],
      daily_report_progress_updates: [],
      hr_crews: [
        {
          id: "crew-cloud",
          company_id: "company-1",
          leader_name: "ทีม Cloud",
          national_id: "1101700234567",
          phone: "0812345678",
          work_types: ["ไฟฟ้า"],
          note: "จาก cloud",
          status: "active",
          created_at: "2026-05-10T00:00:00.000Z",
          updated_at: "2026-05-10T00:00:00.000Z"
        }
      ],
      hr_labor_expenses: [
        {
          id: "expense-cloud",
          company_id: "company-1",
          crew_id: "crew-cloud",
          project_id: null,
          expense_date: "2026-05-12",
          work_type: "ไฟฟ้า",
          description: "ค่าแรง cloud",
          amount: "3000",
          note: "",
          created_at: "2026-05-12T00:00:00.000Z",
          updated_at: "2026-05-12T00:00:00.000Z"
        }
      ],
      buyin_entries: []
    };
    const client = {
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          in: () => query,
          order: async () => ({ data: rowsByTable[table] ?? [], error: null }),
          maybeSingle: async () => ({
            data: {
              id: "company-1",
              name: "บริษัทของฉัน",
              slug: null,
              owner_user_id: null,
              created_at: "2026-05-10T00:00:00.000Z",
              updated_at: "2026-05-10T00:00:00.000Z"
            },
            error: null
          })
        };
        return query;
      }
    };

    const loaded = await loadDataFromSupabaseWithClient(client as never, "company-1");

    expect(loaded.crews).toHaveLength(1);
    expect(loaded.crews[0]).toMatchObject({
      id: "crew-cloud",
      companyId: "company-1",
      leaderName: "ทีม Cloud",
      nationalId: "1101700234567"
    });
    expect(loaded.laborExpenses[0]).toMatchObject({
      id: "expense-cloud",
      companyId: "company-1",
      crewId: "crew-cloud",
      amount: 3000
    });

    const scopedLoaded = await loadDataFromSupabaseWithClient(client as never, "company-1", undefined, [project.id]);
    expect(scopedLoaded.crews).toEqual([]);
    expect(scopedLoaded.laborExpenses).toEqual([]);

    const scopedHrLoaded = await loadDataFromSupabaseWithClient(client as never, "company-1", undefined, {
      allowedProjectIds: [project.id],
      includeCompanyHr: true
    });
    expect(scopedHrLoaded.crews).toHaveLength(1);
    expect(scopedHrLoaded.laborExpenses).toHaveLength(1);
  });

  it("normalizes old JSON without BUYIN and recalculates imported VAT amounts", () => {
    const oldJson = JSON.stringify({
      companies: buildSyncData().companies,
      activeCompanyId: "company-1",
      projects: [],
      activeProjectId: "",
      dailyReports: []
    });
    const oldImported = importProjectControlJson(oldJson, "2026-05-17");
    expect(oldImported.buyinEntries).toEqual([]);

    const imported = importProjectControlJson(
      JSON.stringify({
        ...buildSyncData({
          buyinEntries: [
            {
              id: "buyin-1",
              companyId: "company-1",
              entryDate: "2026-05-17",
              type: "invoice",
              vendorName: "Vendor A",
              vendorTaxId: "1-2345-67890-12-3",
              amountPaid: "1070",
              includeVat: true,
              netAmount: 0,
              vatAmount: 0,
              createdAt: "2026-05-17T00:00:00.000Z",
              updatedAt: "2026-05-17T00:00:00.000Z"
            }
          ] as never
        })
      }),
      "2026-05-17"
    );

    expect(imported.buyinEntries[0].vendorTaxId).toBe("1234567890123");
    expect(imported.buyinEntries[0].netAmount).toBe(1000);
    expect(imported.buyinEntries[0].vatAmount).toBe(70);
  });

  it("keeps BUYIN decimal baht values when creating entries", () => {
    const expenseEntry = createBuyinEntry("company-1", {
      type: "expense",
      storeName: "ร้านทดสอบ",
      amountPaid: 745.36
    });
    const invoiceEntry = createBuyinEntry("company-1", {
      type: "invoice",
      vendorName: "Vendor Decimal",
      vendorTaxId: "1234567890123",
      amountPaid: 745.36,
      includeVat: true
    });

    expect(expenseEntry.amountPaid).toBe(745.36);
    expect(expenseEntry.netAmount).toBe(745.36);
    expect(expenseEntry.vatAmount).toBe(0);
    expect(invoiceEntry.amountPaid).toBe(745.36);
    expect(invoiceEntry.netAmount).toBe(696.6);
    expect(invoiceEntry.vatAmount).toBe(48.76);
  });

  it("adds BUYIN rows to cloud payload and keeps projectless rows out of project-scoped member sync", async () => {
    const projectEntry = createBuyinEntry("company-1", {
      projectId: project.id,
      entryDate: "2026-05-17",
      type: "invoice",
      vendorName: "Vendor A",
      vendorTaxId: "1234567890123",
      amountPaid: 1070,
      includeVat: true
    });
    const companyEntry = createBuyinEntry("company-1", {
      entryDate: "2026-05-17",
      type: "expense",
      storeName: "ร้านทั่วไป",
      amountPaid: 500
    });
    const payload = createCloudSyncPayload(buildSyncData({ buyinEntries: [projectEntry, companyEntry] }));

    expect(payload.buyinEntries).toHaveLength(2);
    expect(payload.buyinEntries[0].vendor_tax_id).toBe("1234567890123");

    const calls: string[] = [];
    const client = {
      from: (table: string) => {
        if (table === "projects") {
          return {
            upsert: async () => ({ data: [], error: null }),
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [{ id: project.id }], error: null })
              })
            }),
            delete: () => ({ eq: async () => ({ data: [], error: null }) })
          };
        }

        return {
          upsert: async (rows: unknown[]) => {
            if (table === "buyin_entries") {
              calls.push(`${table}.${Array.isArray(rows) ? rows.length : 0}`);
            }
            return { data: [], error: null };
          },
          delete: () => ({ eq: async () => ({ data: [], error: null }) })
        };
      }
    };

    await syncDataToSupabaseWithClient(client as never, buildSyncData({ buyinEntries: [projectEntry, companyEntry] }), {
      allowedProjectIds: [project.id],
      canDeleteMissingRows: false
    });

    expect(calls).toContain("buyin_entries.1");
  });
});
