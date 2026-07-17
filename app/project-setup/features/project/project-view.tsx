"use client";

import { useState } from "react";

import {
  calculateCategoryProgress,
  calculateCategoryTotal,
  calculateOverallBoqTotal,
  calculateWeightedProgress,
  formatCurrency,
  formatPercent,
  nonNegativeNumber
} from "@/lib/project-calculations";
import type { Project } from "@/lib/project-storage";
import { getMobileSectionMeta } from "@/lib/project-control/mobile-module-ui";
import { Button, Card, Field, PlaceholderProjectVisual, ProgressBar, ProgressRing, Select, TextArea, TextInput } from "../shared/ui";
import { numberFromInput } from "../shared/utils";
import { BoqItemCard } from "./boq-item-card";
import { MobileEmptyState, MobileModuleHeader, MobileNumberedSection, MobileSummaryStrip } from "../shared/mobile-module-ui";

const teamOptions = ["ภูมิใจ", "แต๊ก", "ต๋ะ", "วรเมธ", "พาส"];
const statusOptions = ["ดำเนินการ", "รอเริ่มงาน", "มีปัญหา", "พักงาน", "จบงานแล้ว"];
export function ProjectInfoView({
  project,
  totalContract,
  updateActiveProject,
  uploadProjectCover,
  removeProjectCover,
  addBoqCategory,
  updateBoqCategory,
  deleteBoqCategory,
  addBoqItem,
  updateBoqItem,
  deleteBoqItem,
  canDeleteBoq
}: {
  project: Project;
  totalContract: number;
  updateActiveProject: (updater: (project: Project) => Project) => void;
  uploadProjectCover: (fileList: FileList | null) => Promise<void>;
  removeProjectCover: () => void;
  addBoqCategory: () => void;
  updateBoqCategory: (categoryId: string, name: string) => void;
  deleteBoqCategory: (categoryId: string) => void;
  addBoqItem: (categoryId: string) => void;
  updateBoqItem: (categoryId: string, itemId: string, patch: Partial<Project["boq"][number]["items"][number]>) => void;
  deleteBoqItem: (categoryId: string, itemId: string) => void;
  canDeleteBoq: boolean;
}) {
  const boqTotal = calculateOverallBoqTotal(project);
  const boqProgress = calculateWeightedProgress(project);
  const [activeMobileSection, setActiveMobileSection] = useState("project-boq");
  const boqItemCount = project.boq.reduce((total, category) => total + category.items.length, 0);
  const mobileSections = {
    boq: getMobileSectionMeta({ id: "project-boq", number: 1, title: "BOQ และความคืบหน้า", completed: boqItemCount > 0 ? 1 : 0, total: 1 }),
    info: getMobileSectionMeta({ id: "project-info", number: 2, title: "ข้อมูลโครงการ", completed: [project.name, project.status, project.owner].filter((value) => value.trim()).length, total: 3 }),
    customer: getMobileSectionMeta({ id: "project-customer", number: 3, title: "ลูกค้าและสถานที่", completed: [project.customer.name, project.customer.siteContact, project.customer.siteAddress].filter((value) => value.trim()).length, total: 3 }),
    budget: getMobileSectionMeta({ id: "project-budget", number: 4, title: "งบประมาณและไทม์ไลน์", completed: [project.budget.mainContract > 0, Boolean(project.timeline.startDate), Boolean(project.timeline.dueDate)].filter(Boolean).length, total: 3 })
  };

  return (
    <>
    <div data-mobile-project-layout className="grid gap-3 pb-32 md:hidden">
      <MobileModuleHeader title="Project / BOQ" context={project.name || "ยังไม่มีชื่อโปรเจกต์"} detail={project.customer.siteAddress || project.owner || "ข้อมูลโครงการ"} />
      <MobileSummaryStrip items={[
        { label: "สถานะ", value: project.status || "ยังไม่ระบุ" },
        { label: "ความคืบหน้า", value: formatPercent(boqProgress) },
        { label: "BOQ รวม", value: formatCurrency(boqTotal), tone: "slate" }
      ]} />
      <div className="grid gap-3">
        <MobileNumberedSection meta={mobileSections.boq} expanded={activeMobileSection === mobileSections.boq.id} onToggle={() => setActiveMobileSection(mobileSections.boq.id)}>
          <div className="grid gap-3 bg-emerald-50/30 p-3">
            <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-black text-slate-800">ต้นทุนและความคืบหน้า</p><p className="text-xs text-slate-500">{project.boq.length} หมวด · {boqItemCount} รายการ</p></div><Button className="min-h-10 px-3 text-xs" onClick={addBoqCategory}>+ เพิ่มหมวด</Button></div>
            {project.boq.length === 0 ? <MobileEmptyState>ยังไม่มีหมวดงาน BOQ</MobileEmptyState> : project.boq.map((category) => (
              <section key={category.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <TextInput aria-label="ชื่อหมวด BOQ" value={category.name} onChange={(event) => updateBoqCategory(category.id, event.target.value)} />
                <div className="flex items-center justify-between text-xs font-bold text-slate-500"><span>{formatCurrency(calculateCategoryTotal(category))}</span><span className="text-emerald-700">{formatPercent(calculateCategoryProgress(category))}</span></div>
                <ProgressBar value={calculateCategoryProgress(category)} />
                <div className="grid gap-2">{category.items.map((item) => <BoqItemCard key={item.id} categoryName={category.name} item={item} onChange={(patch) => updateBoqItem(category.id, item.id, patch)} onDelete={() => deleteBoqItem(category.id, item.id)} canDelete={canDeleteBoq} />)}</div>
                <div className="grid grid-cols-2 gap-2"><Button className="min-h-10 px-2 text-xs" variant="secondary" onClick={() => addBoqItem(category.id)}>+ เพิ่มรายการ</Button>{canDeleteBoq ? <Button className="min-h-10 px-2 text-xs" variant="danger" onClick={() => deleteBoqCategory(category.id)}>ลบหมวด</Button> : <div />}</div>
              </section>
            ))}
          </div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.info} expanded={activeMobileSection === mobileSections.info.id} onToggle={() => setActiveMobileSection(mobileSections.info.id)}>
          <div className="grid gap-3 p-3">
            <Field label="ชื่อโปรเจกต์"><TextInput value={project.name} onChange={(event) => updateActiveProject((current) => ({ ...current, name: event.target.value }))} /></Field>
            <Field label="สถานะ"><Select value={project.status} onChange={(event) => updateActiveProject((current) => ({ ...current, status: event.target.value }))}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</Select></Field>
            <Field label="เจ้าของบ้าน"><TextInput value={project.owner} onChange={(event) => updateActiveProject((current) => ({ ...current, owner: event.target.value }))} /></Field>
            <Field label="หมายเหตุ"><TextArea value={project.note} onChange={(event) => updateActiveProject((current) => ({ ...current, note: event.target.value }))} /></Field>
          </div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.customer} expanded={activeMobileSection === mobileSections.customer.id} onToggle={() => setActiveMobileSection(mobileSections.customer.id)}>
          <div className="grid gap-3 p-3">
            <Field label="ชื่อลูกค้า / ผู้ว่าจ้าง"><TextInput value={project.customer.name} onChange={(event) => updateActiveProject((current) => ({ ...current, customer: { ...current.customer, name: event.target.value } }))} /></Field>
            <Field label="ผู้ติดต่อไซต์"><TextInput value={project.customer.siteContact} onChange={(event) => updateActiveProject((current) => ({ ...current, customer: { ...current.customer, siteContact: event.target.value } }))} /></Field>
            <Field label="เบอร์โทรผู้ติดต่อไซต์"><TextInput value={project.customer.phone} onChange={(event) => updateActiveProject((current) => ({ ...current, customer: { ...current.customer, phone: event.target.value } }))} /></Field>
            <Field label="ที่อยู่ไซต์"><TextArea value={project.customer.siteAddress} onChange={(event) => updateActiveProject((current) => ({ ...current, customer: { ...current.customer, siteAddress: event.target.value } }))} /></Field>
          </div>
        </MobileNumberedSection>
        <MobileNumberedSection meta={mobileSections.budget} expanded={activeMobileSection === mobileSections.budget.id} onToggle={() => setActiveMobileSection(mobileSections.budget.id)}>
          <div className="grid gap-3 p-3">
            <Field label="มูลค่าสัญญาหลัก"><TextInput type="number" min={0} value={project.budget.mainContract} onChange={(event) => updateActiveProject((current) => ({ ...current, budget: { ...current.budget, mainContract: nonNegativeNumber(numberFromInput(event.target.value)) } }))} /></Field>
            <Field label="มูลค่างาน VO เพิ่มเติม"><TextInput type="number" min={0} value={project.budget.variationOrder} onChange={(event) => updateActiveProject((current) => ({ ...current, budget: { ...current.budget, variationOrder: nonNegativeNumber(numberFromInput(event.target.value)) } }))} /></Field>
            <Field label="วันเริ่มงาน"><TextInput type="date" value={project.timeline.startDate} onChange={(event) => updateActiveProject((current) => ({ ...current, timeline: { ...current.timeline, startDate: event.target.value } }))} /></Field>
            <Field label="กำหนดส่งมอบ"><TextInput type="date" value={project.timeline.dueDate} onChange={(event) => updateActiveProject((current) => ({ ...current, timeline: { ...current.timeline, dueDate: event.target.value } }))} /></Field>
          </div>
        </MobileNumberedSection>
      </div>
    </div>
    <div data-desktop-project-layout className="hidden md:block">
    <div className="grid gap-4">
      <Card data-project-desktop-summary className="overflow-hidden border-slate-200 p-4">
        <div className="grid gap-5 xl:grid-cols-[220px_1fr_180px] xl:items-center">
          <div>
            <PlaceholderProjectVisual
              label="Project"
              compact
              imageUrl={project.coverImage?.dataUrl}
              imageAlt={project.coverImage?.name ?? project.name}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="grid min-h-11 cursor-pointer place-items-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:border-slate-300 hover:bg-slate-50">
                อัพรูปหน้าปก
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    void uploadProjectCover(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              {project.coverImage ? (
                <Button variant="danger" className="min-h-11 px-4" onClick={removeProjectCover}>
                  ลบรูป
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
              รูปนี้ใช้เป็นหน้าปก workspace ของ Project และการ์ดสรุปใน Dashboard / Daily Report
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500">Project Setup</p>
            <h3
              className="mt-2 line-clamp-2 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-950"
              title={project.name || "ยังไม่มีชื่อโปรเจกต์"}
            >
              {project.name || "ยังไม่มีชื่อโปรเจกต์"}
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              จัดข้อมูลโปรเจกต์, ทีม, ลูกค้า, budget และ BOQ ใน flow เดียว เพื่อให้การ setup งานหน้างานและการคุมงบอยู่ในหน้าที่อ่านง่ายขึ้น
            </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Contract Total</p>
                <p className="mt-2 text-xl font-black text-slate-950">{formatCurrency(totalContract)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">BOQ Total</p>
                <p className="mt-2 text-xl font-black text-slate-950">{formatCurrency(boqTotal)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Customer</p>
                <p
                  className="mt-2 line-clamp-2 text-base font-black leading-6 text-slate-950"
                  title={project.customer.name || "ยังไม่ระบุลูกค้า"}
                >
                  {project.customer.name || "ยังไม่ระบุลูกค้า"}
                </p>
              </div>
            </div>
          </div>
          <div className="grid place-items-center rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <ProgressRing value={boqProgress} tone="emerald" />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Project Progress</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-black tracking-tight">ข้อมูลทั่วไป</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="ชื่อโปรเจกต์">
            <TextInput value={project.name} onChange={(event) => updateActiveProject((p) => ({ ...p, name: event.target.value }))} />
          </Field>
          <Field label="สถานะ">
            <Select value={project.status} onChange={(event) => updateActiveProject((p) => ({ ...p, status: event.target.value }))}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="เจ้าของบ้าน">
            <TextInput value={project.owner} onChange={(event) => updateActiveProject((p) => ({ ...p, owner: event.target.value }))} />
          </Field>
          <div className="grid gap-2">
            <p className="text-xs font-semibold text-slate-600">ทีมผู้ดูแล</p>
            <div className="flex flex-wrap gap-2">
              {teamOptions.map((member) => (
                <label key={member} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={project.team.includes(member)}
                    onChange={(event) =>
                      updateActiveProject((p) => ({
                        ...p,
                        team: event.target.checked ? [...p.team, member] : p.team.filter((item) => item !== member)
                      }))
                    }
                  />
                  {member}
                </label>
              ))}
            </div>
          </div>
          <Field label="หมายเหตุ">
            <TextArea value={project.note} onChange={(event) => updateActiveProject((p) => ({ ...p, note: event.target.value }))} />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-black tracking-tight">ข้อมูลลูกค้า</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="ชื่อลูกค้า / ผู้ว่าจ้าง">
            <TextInput
              value={project.customer.name}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, name: event.target.value } }))}
            />
          </Field>
          <Field label="ผู้ติดต่อไซต์">
            <TextInput
              value={project.customer.siteContact}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, siteContact: event.target.value } }))}
            />
          </Field>
          <Field label="เบอร์โทรผู้ติดต่อไซต์">
            <TextInput
              value={project.customer.phone}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, phone: event.target.value } }))}
            />
          </Field>
          <Field label="ที่อยู่ไซต์">
            <TextInput
              value={project.customer.siteAddress}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, siteAddress: event.target.value } }))}
            />
          </Field>
          <Field label="อีเมล">
            <TextInput
              type="email"
              value={project.customer.email}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, email: event.target.value } }))}
            />
          </Field>
          <Field label="LINE ID">
            <TextInput
              value={project.customer.lineId}
              onChange={(event) => updateActiveProject((p) => ({ ...p, customer: { ...p.customer, lineId: event.target.value } }))}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-black tracking-tight">งบประมาณ</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="มูลค่าสัญญาหลัก">
            <TextInput
              type="number"
              min={0}
              value={project.budget.mainContract}
              onChange={(event) =>
                updateActiveProject((p) => ({
                  ...p,
                  budget: { ...p.budget, mainContract: nonNegativeNumber(numberFromInput(event.target.value)) }
                }))
              }
            />
          </Field>
          <Field label="มูลค่างาน VO เพิ่มเติม">
            <TextInput
              type="number"
              min={0}
              value={project.budget.variationOrder}
              onChange={(event) =>
                updateActiveProject((p) => ({
                  ...p,
                  budget: { ...p.budget, variationOrder: nonNegativeNumber(numberFromInput(event.target.value)) }
                }))
              }
            />
          </Field>
          <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-black text-teal-800">รวมทั้งสิ้น</p>
            <p className="mt-2 text-2xl font-black text-teal-900">{formatCurrency(totalContract)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-black tracking-tight">ไทม์ไลน์เบื้องต้น</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="วันเริ่มงาน">
            <TextInput
              type="date"
              value={project.timeline.startDate}
              onChange={(event) => updateActiveProject((p) => ({ ...p, timeline: { ...p.timeline, startDate: event.target.value } }))}
            />
          </Field>
          <Field label="กำหนดส่งมอบ">
            <TextInput
              type="date"
              value={project.timeline.dueDate}
              onChange={(event) => updateActiveProject((p) => ({ ...p, timeline: { ...p.timeline, dueDate: event.target.value } }))}
            />
          </Field>
        </div>
      </Card>

      <Card className="border-slate-200 bg-[linear-gradient(180deg,rgba(248,250,252,0.7),rgba(255,255,255,0.96))]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-950">BOQ อยู่ในหน้า Project แล้ว</h3>
            <p className="text-sm text-slate-600">จัดการข้อมูลโปรเจกต์และ BOQ ใน flow เดียว เพื่อลดการสลับหน้าและอ่านภาพรวมได้ง่ายขึ้น</p>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">
            BOQ รวมใน Project
          </div>
        </div>
      </Card>

      <BoqView
        project={project}
        addBoqCategory={addBoqCategory}
        updateBoqCategory={updateBoqCategory}
        deleteBoqCategory={deleteBoqCategory}
        addBoqItem={addBoqItem}
        updateBoqItem={updateBoqItem}
        deleteBoqItem={deleteBoqItem}
        canDeleteBoq={canDeleteBoq}
      />
    </div>
    </div>
    </>
  );
}

export function BoqView({
  project,
  addBoqCategory,
  updateBoqCategory,
  deleteBoqCategory,
  addBoqItem,
  updateBoqItem,
  deleteBoqItem,
  canDeleteBoq
}: {
  project: Project;
  addBoqCategory: () => void;
  updateBoqCategory: (categoryId: string, name: string) => void;
  deleteBoqCategory: (categoryId: string) => void;
  addBoqItem: (categoryId: string) => void;
  updateBoqItem: (categoryId: string, itemId: string, patch: Partial<Project["boq"][number]["items"][number]>) => void;
  deleteBoqItem: (categoryId: string, itemId: string) => void;
  canDeleteBoq: boolean;
}) {
  const total = calculateOverallBoqTotal(project);
  const progress = calculateWeightedProgress(project);

  return (
    <div className="grid gap-4">
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1fr_180px] xl:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-500">BOQ Summary</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">ต้นทุนและความคืบหน้าแบบถ่วงน้ำหนัก</h3>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">BOQ Total</p>
                <p className="mt-2 text-lg font-black text-slate-950">{formatCurrency(total)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Weighted Progress</p>
                <p className="mt-2 text-lg font-black text-slate-950">{formatPercent(progress)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Categories</p>
                <p className="mt-2 text-lg font-black text-slate-950">{project.boq.length}</p>
              </div>
            </div>
            <div className="mt-5">
              <ProgressBar value={progress} tone="amber" />
            </div>
          </div>
          <div className="grid gap-4">
            <div className="grid place-items-center rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <ProgressRing value={progress} size={100} stroke={9} tone="blue" />
            </div>
            <Button onClick={addBoqCategory}>+ เพิ่มหมวดงาน</Button>
            {!canDeleteBoq ? (
              <p className="text-center text-xs font-bold leading-5 text-slate-500">ลบ BOQ ได้เฉพาะ Admin/Owner</p>
            ) : null}
          </div>
        </div>
      </Card>

      {project.boq.length === 0 ? (
        <Card className="text-center">
          <h3 className="text-xl font-black tracking-tight">ยังไม่มีหมวดงาน BOQ</h3>
          <p className="mt-2 text-sm text-slate-600">เพิ่มหมวดงานเพื่อเริ่มคำนวณต้นทุนและความคืบหน้าแบบถ่วงน้ำหนัก</p>
          <Button className="mt-4" onClick={addBoqCategory}>
            + เพิ่มหมวดงาน
          </Button>
        </Card>
      ) : (
        project.boq.map((category) => (
          <Card key={category.id} className="overflow-hidden">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
              <TextInput value={category.name} onChange={(event) => updateBoqCategory(category.id, event.target.value)} />
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                {formatCurrency(calculateCategoryTotal(category))} • {formatPercent(calculateCategoryProgress(category))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => addBoqItem(category.id)}>
                  + เพิ่มรายการ
                </Button>
                {canDeleteBoq ? (
                  <Button variant="danger" onClick={() => deleteBoqCategory(category.id)}>
                    ลบ
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar value={calculateCategoryProgress(category)} />
            </div>

            {category.items.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">ยังไม่มีรายการ</div>
            ) : (
              <div className="mt-4 grid gap-3">
                {category.items.map((item) => (
                  <BoqItemCard
                    key={item.id}
                    categoryName={category.name}
                    item={item}
                    canDelete={canDeleteBoq}
                    onChange={(patch) => updateBoqItem(category.id, item.id, patch)}
                    onDelete={() => deleteBoqItem(category.id, item.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
