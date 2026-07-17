"use client";

import type React from "react";
import { calculateWeightedProgress, clampProgress, formatPercent } from "@/lib/project-calculations";
import { hasPrintableContent, MAX_DAILY_REPORT_PHOTOS } from "@/lib/daily-report-media";
import type { DailyReport, Project } from "@/lib/project-storage";
function PdfProgressBar({ value }: { value: number }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-300">
      <div className="h-full bg-teal-700" style={{ width: `${clampProgress(value)}%` }} />
    </div>
  );
}

function PdfSectionTitle({ title, tone = "default" }: { title: string; tone?: "default" | "danger" }) {
  return (
    <h2
      className={`border-b pb-2 text-[18px] font-bold leading-[1.45] ${
        tone === "danger" ? "border-red-200 text-red-700" : "border-slate-300 text-slate-950"
      }`}
    >
      {title}
    </h2>
  );
}

type PdfPhotoItem = {
  id: string;
  dataUrl: string;
  name: string;
  caption: string;
};

function PdfPhotoGallery({
  title,
  eyebrow,
  photos,
  galleryId,
  tone = "teal",
  emptyText,
  forcePageBreakBefore = false
}: {
  title: string;
  eyebrow: string;
  photos: PdfPhotoItem[];
  galleryId: "problem-photos" | "site-photos";
  tone?: "teal" | "red";
  emptyText: string;
  forcePageBreakBefore?: boolean;
}) {
  const accentClass = tone === "red" ? "bg-red-600" : "bg-teal-700";
  const badgeClass = tone === "red" ? "bg-red-50 text-red-700" : "bg-teal-50 text-teal-700";
  const galleryGridStyle =
    galleryId === "problem-photos"
      ? { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }
      : { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" };

  return (
    <section
      data-pdf-section="true"
      data-pdf-gallery={galleryId}
      data-pdf-force-page-break={forcePageBreakBefore ? "before" : undefined}
      className={`print-card break-inside-avoid ${forcePageBreakBefore ? "mt-0" : "mt-5"}`}
    >
      <div className="overflow-visible rounded-[16px] border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-8 w-1.5 rounded-full ${accentClass}`} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold leading-[2] text-slate-500">{eyebrow}</p>
              <h2 className="whitespace-normal text-[18px] font-bold leading-[2] text-slate-950">{title}</h2>
            </div>
          </div>
          <div className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold leading-[1.8] ${badgeClass}`}>{photos.length} รูป</div>
        </div>

        {photos.length > 0 ? (
          <div className="mt-3 grid gap-2.5" style={galleryGridStyle}>
            {photos.map((photo, index) => (
              <figure
                key={photo.id}
                data-pdf-section="true"
                data-pdf-photo-card="true"
                className="break-inside-avoid overflow-hidden rounded-[12px] border border-slate-200 bg-white"
              >
                <div className="aspect-[4/3] max-h-[190px] w-full overflow-hidden bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.dataUrl} alt={photo.name} className="h-full w-full object-contain" />
                </div>
                <figcaption className="flex items-start justify-between gap-2 px-2 py-2.5">
                  <span className="min-w-0 break-words text-[12px] font-semibold leading-[1.8] text-slate-700">{photo.caption}</span>
                  <span className="shrink-0 text-[11px] font-bold leading-[1.8] text-slate-500">#{index + 1}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-[14px] border border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center text-[16px] font-semibold leading-[2] text-slate-500">
            {emptyText}
          </div>
        )}
      </div>
    </section>
  );
}

export function DailyReportSheetContent({
  project,
  report,
  companyName = "บริษัทของฉัน",
  hideCompanyName = false,
  reporterName = "ผู้ใช้งาน",
  reporterPhone = "-"
}: {
  project: Project;
  report: DailyReport;
  companyName?: string;
  hideCompanyName?: boolean;
  reporterName?: string;
  reporterPhone?: string;
}) {
  const progress = calculateWeightedProgress(project);
  const noteRows = [
    { label: "สรุปงานวันนี้", value: report.summary },
    { label: "งานที่ทำเสร็จวันนี้", value: report.completedWork },
    { label: "งานที่กำลังดำเนินการ", value: report.ongoingWork },
    { label: "วัสดุที่ใช้ / วัสดุเข้าไซต์", value: report.materials },
    { label: "แผนงานวันถัดไป", value: report.nextPlan },
    { label: "หมายเหตุถึงลูกค้า", value: report.customerNote },
    { label: "หมายเหตุภายในทีม", value: report.internalNote }
  ].filter((section) => hasPrintableContent(section.value));
  const problemPhotoItems = report.problemIssues.flatMap((issue, issueIndex) =>
    issue.photos.map((photo, photoIndex) => ({
      id: `${issue.id}-${photo.id}`,
      dataUrl: photo.dataUrl,
      name: photo.name,
      caption: `${issue.title || `ปัญหา ${issueIndex + 1}`} / รูป ${photoIndex + 1}`
    }))
  );
  const sitePhotoItems = report.photos.slice(0, MAX_DAILY_REPORT_PHOTOS).map((photo, index) => ({
    id: photo.id,
    dataUrl: photo.dataUrl,
    name: photo.name,
    caption: `ภาพหน้างาน ${index + 1}`
  }));
  const pdfInfoItems = [
    ...(hideCompanyName ? [] : [{ label: "บริษัท", value: companyName || "-" }]),
    { label: "ลูกค้า", value: project.customer.name || "-" },
    { label: "ผู้ทำรายการ", value: reporterName || "-" },
    { label: "เบอร์โทรผู้ทำรายการ", value: reporterPhone || "-" },
    { label: "ผู้ติดต่อไซต์", value: project.customer.siteContact || "-" },
    { label: "เบอร์โทรผู้ติดต่อไซต์", value: project.customer.phone || "-" },
    { label: "ที่อยู่ไซต์", value: project.customer.siteAddress || "-" }
  ];
  const pdfDocumentStyle = {
    fontFamily: "var(--font-sarabun), \"TH Sarabun New\", \"Sarabun\", sans-serif"
  };

  return (
    <div
      className="mx-auto min-h-[1123px] max-w-[794px] overflow-visible bg-[#f8fbff] px-8 py-7 text-[16px] leading-[2] text-slate-950"
      style={pdfDocumentStyle}
    >
      <header data-pdf-section="true" className="print-card rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-[minmax(0,1fr)_180px] items-start gap-5">
          <div className="min-w-0">
            {hideCompanyName ? null : <p className="text-[14px] font-bold leading-[2] text-teal-700">{companyName || "บริษัทของฉัน"}</p>}
            <h1 className="mt-1 break-words text-[30px] font-bold leading-[1.65] text-slate-950">{project.name || "Daily Report"}</h1>
            <p className="mt-1 whitespace-normal break-words text-[16px] font-semibold leading-[2] text-slate-600">
              Daily Report | {report.reportDate} | Status: {project.status || "-"}
            </p>
          </div>
          <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[14px] font-bold leading-[1.8] text-slate-600">Project Progress</p>
              <p className="text-[24px] font-bold text-teal-800">{formatPercent(progress)}</p>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-300">
              <div className="h-full bg-teal-700" style={{ width: `${clampProgress(progress)}%` }} />
            </div>
          </div>
        </div>
      </header>

      <section data-pdf-section="true" className="print-card mt-5">
        <div className="grid grid-cols-2 overflow-visible rounded-[18px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.05)] md:grid-cols-4">
          {pdfInfoItems.map(({ label, value }) => (
            <div key={label} className="min-h-16 border-b border-r border-slate-200 px-3 py-3">
              <p className="text-[12px] font-bold leading-[2] text-slate-500">{label}</p>
              <p className="mt-1 whitespace-normal break-words text-[16px] font-semibold leading-[2] text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {noteRows.length > 0 ? (
        <section data-pdf-section="true" className="print-card mt-6">
          <PdfSectionTitle title="Daily Work Notes" />
          <div className="mt-2 overflow-visible rounded-[18px] border border-slate-200 bg-white">
            {noteRows.map((section, index) => (
              <div
                key={section.label}
                data-pdf-section="true"
                className={`grid grid-cols-[150px_1fr] ${index === 0 ? "" : "border-t border-slate-200"}`}
              >
                <div className="whitespace-normal break-words bg-slate-50 px-3 py-3 text-[15px] font-bold leading-[2] text-teal-800">{section.label}</div>
                <div className="whitespace-pre-wrap break-words px-3 py-3 text-[16px] font-normal leading-[2] text-slate-800">{section.value}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.problemIssues.length > 0 ? (
        <section data-pdf-section="true" className="print-card mt-6">
          <PdfSectionTitle title="Problems / Obstacles" tone="danger" />
          <div className="mt-2 grid gap-2">
            {report.problemIssues.map((issue, index) => (
              <div key={issue.id} data-pdf-section="true" className="rounded-[16px] border border-red-100 border-l-4 border-l-red-600 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-4">
                  <p className="break-words text-[18px] font-bold leading-[2] text-slate-950">{issue.title || `ปัญหา ${index + 1}`}</p>
                  <p className="shrink-0 text-right text-[14px] font-bold leading-[2] text-red-700">Issue {index + 1}</p>
                </div>
                {hasPrintableContent(issue.detail) ? <p className="mt-1 whitespace-pre-wrap break-words text-[16px] leading-[2] text-slate-800">{issue.detail}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PdfPhotoGallery
        title="ภาพปัญหาที่เกิดขึ้น"
        eyebrow="Problem Photos"
        photos={problemPhotoItems}
        galleryId="problem-photos"
        tone="red"
        emptyText="ยังไม่มีภาพปัญหาในรายงานนี้"
      />

      {report.progressUpdates.length > 0 ? (
        <section data-pdf-section="true" className="print-card mt-6">
          <PdfSectionTitle title="Daily Progress Update" />
          <div className="mt-2 border border-slate-300">
            {report.progressUpdates.map((update, index) => (
              <div
                key={update.id}
                className={`grid grid-cols-[1fr_170px] gap-4 px-3 py-2.5 ${index === 0 ? "" : "border-t border-slate-200"}`}
              >
                <div className="min-w-0">
                  <p className="break-words text-[17px] font-bold leading-[2] text-slate-950">{update.title || "ความคืบหน้า"}</p>
                  {hasPrintableContent(update.note) ? <p className="mt-0.5 break-words text-[14px] leading-[2] text-slate-600">{update.note}</p> : null}
                </div>
                <div>
                  <p className="text-right text-[16px] font-bold leading-[2]">
                    <span className="text-red-600">{update.previousProgress}%</span>
                    <span className="px-1 text-slate-400">to</span>
                    <span className="text-emerald-700">{update.newProgress}%</span>
                  </p>
                  <div className="mt-1">
                    <PdfProgressBar value={update.newProgress} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {report.workers.length > 0 ? (
        <section data-pdf-section="true" className="print-card mt-6">
          <PdfSectionTitle title="Work Attendance" />
          <table className="mt-2 w-full table-fixed border-collapse text-[14px] leading-[1.8]">
            <thead>
              <tr className="bg-slate-950 text-left uppercase text-white">
                <th className="w-[18%] border border-slate-950 px-2 py-2">Name</th>
                <th className="w-[13%] border border-slate-950 px-2 py-2">Trade</th>
                <th className="w-[8%] border border-slate-950 px-2 py-2 text-right">Qty</th>
                <th className="w-[10%] border border-slate-950 px-2 py-2">Start</th>
                <th className="w-[10%] border border-slate-950 px-2 py-2">End</th>
                <th className="w-[27%] border border-slate-950 px-2 py-2">Task</th>
                <th className="w-[14%] border border-slate-950 px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {report.workers.map((worker) => (
                <tr key={worker.id} className="break-inside-avoid">
                  <td className="break-words border border-slate-300 px-2 py-2 font-semibold">{worker.name || "-"}</td>
                  <td className="break-words border border-slate-300 px-2 py-2">{worker.trade || "-"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right">{worker.count}</td>
                  <td className="border border-slate-300 px-2 py-2">{worker.startTime || "-"}</td>
                  <td className="border border-slate-300 px-2 py-2">{worker.endTime || "-"}</td>
                  <td className="break-words border border-slate-300 px-2 py-2">{worker.taskTitle || "-"}</td>
                  <td className="break-words border border-slate-300 px-2 py-2 font-semibold">{worker.taskStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <PdfPhotoGallery
        title="ภาพรายงานหน้างาน"
        eyebrow={`Site Photos / max ${MAX_DAILY_REPORT_PHOTOS}`}
        photos={sitePhotoItems}
        galleryId="site-photos"
        emptyText="ยังไม่มีภาพหน้างานในรายงานนี้"
        forcePageBreakBefore
      />
    </div>
  );
}

export function PrintDailyReportSheet({
  project,
  report,
  companyName,
  hideCompanyName,
  reporterName,
  reporterPhone
}: {
  project: Project;
  report: DailyReport;
  companyName?: string;
  hideCompanyName?: boolean;
  reporterName?: string;
  reporterPhone?: string;
}) {
  return (
    <section className="print-report-root hidden bg-white print:block">
      <DailyReportSheetContent
        project={project}
        report={report}
        companyName={companyName}
        hideCompanyName={hideCompanyName}
        reporterName={reporterName}
        reporterPhone={reporterPhone}
      />
    </section>
  );
}
