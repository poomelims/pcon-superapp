# AGENTS.md

## 1. Project Identity
PCON Project Control is a modern construction project control app for contractors, renovation teams, home builders, site supervisors, office admins, and small-to-medium construction businesses.

This product is built to support real field operations around housing and living-space construction. It must feel practical, trustworthy, fast, and worth paying for.

## 2. Product North Star
The product must help users quickly answer:

- วันนี้ไซต์งานทำอะไรไปแล้ว?
- ช่างเข้าไซต์กี่คน?
- งานคืบหน้ากี่เปอร์เซ็นต์?
- BOQ รวมเท่าไหร่?
- มีปัญหาอะไรต้องตาม?
- พรุ่งนี้ต้องทำอะไรต่อ?
- ต้องรายงานอะไรให้ลูกค้ารู้?
- โปรเจกต์ไหนกำลังดี?
- โปรเจกต์ไหนเริ่มมีปัญหา?

## 3. Core Modules
Current priority modules:

- Project
- BOQ
- Daily Report

Future modules:

- Supabase Cloud Sync
- Login
- Company Workspace
- Role / Owner / Member
- Payment Milestones
- Timeline
- PDF Export
- AI Summary
- Client Report
- Team Invite
- Multi-company SaaS

## 4. Non-negotiable Priorities
AI agents must prioritize in this order:

1. Real-world usability
2. Mobile speed
3. Daily Report workflow
4. Data persistence
5. BOQ and weighted progress calculation
6. Clear dashboard summary
7. Clean architecture
8. Supabase-ready foundation
9. Vercel Free / Hobby compatibility
10. Premium but practical visual design

## 5. Current Phase Rule
For Phase 1, focus only on:

- Project
- BOQ
- Daily Report
- localStorage
- Import / Export
- Mobile UX
- Local run stability

Do not build in Phase 1:

- Full login
- Full Supabase Auth
- Full role system
- Payment module
- Timeline module
- PDF export
- AI report
- Image upload
- Client portal
- SaaS billing

## 6. Architecture Direction
Use:

- Next.js
- React
- TypeScript if available
- Tailwind CSS
- shadcn/ui only if already installed
- localStorage for Phase 1
- Supabase-ready architecture for future phases
- Vercel Free / Hobby friendly approach

The app must support future:

- `companyId`
- `activeCompanyId`
- owner role
- company members
- multi-company SaaS
- Supabase Auth
- RLS

## 7. Local-first Rule
Phase 1 must work locally first.

Data must persist with localStorage using:

`pcon_project_setup_data`

If no company exists, create a default local company:

- name: `บริษัทของฉัน`
- role: `owner`

## 8. Multi-company Future Rule
All future business data must support company separation.

Important rules:

- Every project must have `companyId`
- Every daily report must have `companyId` and `projectId`
- Future BOQ, payment, timeline, workers, and reports must be company-scoped
- A user role belongs to company membership, not global user identity
- Owner role must be prepared from the beginning

Roles to support in future:

- `owner`
- `admin`
- `project_manager`
- `site_supervisor`
- `office_staff`
- `worker`
- `viewer`

## 9. Data Model Direction
Preferred frontend data model:

### ProjectControlData
- `companies`
- `activeCompanyId`
- `projects`
- `activeProjectId`
- `dailyReports`

### Project
- `id`
- `companyId`
- `name`
- `status`
- `owner`
- `team`
- `note`
- `customer`
- `budget`
- `timeline`
- `boq`
- `createdAt`
- `updatedAt`

### DailyReport
- `id`
- `companyId`
- `projectId`
- `reportDate`
- `summary`
- `completedWork`
- `ongoingWork`
- `problems`
- `materials`
- `nextPlan`
- `customerNote`
- `internalNote`
- `workers`
- `progressUpdates`
- `createdAt`
- `updatedAt`

## 10. BOQ Calculation Rules
Agents must always calculate BOQ progress using weighted progress, not simple average.

Rules:

- `itemTotal = quantity * unitPrice`
- `categoryTotal = sum(itemTotal)`
- `overallBoqTotal = sum(categoryTotal)`
- `weightedProgressAmount = itemTotal * item.progress / 100`
- `projectProgressPercent = sum(weightedProgressAmount) / overallBoqTotal * 100`

Guardrails:

- If `overallBoqTotal` is `0`, progress is `0`
- Progress must be clamped between `0` and `100`
- Quantity and unit price cannot be negative

## 11. Daily Report Rules
Daily Report is not optional.
Daily Report must never be treated as a placeholder.

Daily Report must support:

- Create report
- Edit report
- Delete report
- Save report
- Report history
- Worker/team rows
- Completed work
- Ongoing work
- Problems/blockers
- Materials
- Next plan
- Customer note
- Internal note
- Project-specific filtering
- Persistence after refresh
- Import / Export

## 12. UX Design Rules
The UI must be:

- Mobile-first
- Clean
- Modern
- Premium but practical
- Fast
- Easy for contractors
- Not raw HTML
- Not generic admin template
- Not overly complicated

Use:

- Card-based layout
- Clear hierarchy
- Large tap targets
- Soft shadows
- `rounded-2xl`
- Simple colors
- Clear empty states
- Clear success/error feedback

Avoid:

- Too many colors
- Heavy animation
- Tiny buttons
- Confusing forms
- Overly empty dashboards
- Decorative UI that slows real work

## 13. Coding Rules
Agents must:

- Audit before coding
- Make a short plan before implementation
- Prefer small safe changes
- Avoid rebuilding the whole app unless explicitly requested
- Do not break existing Project, BOQ, Daily Report flows
- Keep localStorage persistence working
- Keep Import / Export working
- Keep mobile UX practical
- Keep code readable and maintainable
- Avoid unnecessary packages
- Avoid fake buttons
- Avoid `href="#"`
- Avoid empty `onClick` handlers
- Avoid hardcoded Supabase keys
- Never expose service role keys in frontend

## 14. Testing Rules
After changes, agents should run available commands:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

If a command does not exist, say so.
If a command fails, fix it if possible before finishing.

Manual checks should include:

- Create project
- Save
- Refresh
- BOQ category
- BOQ item
- Weighted progress
- Daily Report create
- Daily Report edit
- Daily Report delete
- Report history
- Export JSON
- Import JSON
- Mobile usability
- No fake buttons
- No major console errors

## 15. Phase Workflow
Agents must follow this roadmap:

### Phase 1
Project + BOQ + Daily Report local MVP

### Phase 1.5
UX, bug, performance, and acceptance polish

### Phase 2
Supabase Cloud Sync without full login

### Phase 3
Login + Company Workspace

### Phase 4
Role / Owner / Member permissions

### Phase 5
Daily Report advanced features, client report, PDF, AI summary

### Phase 6
Payment + Timeline

### Phase 7
SaaS productization, pricing, onboarding, team invite

## 16. Work Style
Agents must not overbuild.
Agents must not add future features too early.
Agents must not make broad changes when the user asks for a small fix.
Agents must protect the working core.

When fixing Phase 1:

- Do not rebuild the whole app
- Improve only the requested item
- Keep Project, BOQ, Daily Report, localStorage, and Import/Export working

## 17. Final Response Format
Every agent task should end with:

- What was audited
- What was changed
- Files modified
- Commands run
- Test result
- Remaining risks
- Recommended next step
