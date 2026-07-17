export type CompanyRole =
  | "owner"
  | "admin"
  | "project_manager"
  | "site_supervisor"
  | "office_staff"
  | "worker"
  | "viewer";

export type Company = {
  id: string;
  name: string;
  role: CompanyRole;
  createdAt: string;
  updatedAt: string;
};

export type BoqItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  progress: number;
};

export type BoqCategory = {
  id: string;
  name: string;
  items: BoqItem[];
};

export type ProjectCoverImage = {
  id: string;
  name: string;
  dataUrl: string;
};

export type Project = {
  id: string;
  companyId: string;
  name: string;
  status: string;
  owner: string;
  team: string[];
  note: string;
  coverImage: ProjectCoverImage | null;
  customer: {
    name: string;
    phone: string;
    email: string;
    lineId: string;
    siteAddress: string;
    siteContact: string;
  };
  budget: {
    mainContract: number;
    variationOrder: number;
  };
  timeline: {
    startDate: string;
    dueDate: string;
  };
  boq: BoqCategory[];
  createdAt: string;
  updatedAt: string;
};

export type DailyWorker = {
  id: string;
  crewId?: string;
  name: string;
  trade: string;
  count: number;
  startTime: string;
  endTime: string;
  taskTitle: string;
  taskStatus: "ดำเนินการ" | "แก้ไข" | "เสร็จ";
  note: string;
};

export type Crew = {
  id: string;
  companyId: string;
  leaderName: string;
  nationalId: string;
  phone?: string;
  workTypes: string[];
  note?: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type LaborExpense = {
  id: string;
  companyId: string;
  crewId: string;
  projectId?: string;
  expenseDate: string;
  workType?: string;
  description: string;
  amount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type BuyinEntryType = "expense" | "invoice";

export type BuyinEntry = {
  id: string;
  companyId: string;
  projectId?: string;
  entryDate: string;
  type: BuyinEntryType;
  storeName?: string;
  vendorName?: string;
  vendorTaxId?: string;
  description?: string;
  category?: string;
  amountPaid: number;
  includeVat: boolean;
  netAmount: number;
  vatAmount: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyProgressUpdate = {
  id: string;
  categoryId?: string;
  itemId?: string;
  title: string;
  previousProgress: number;
  newProgress: number;
  note: string;
};

export type DailyReportPhoto = {
  id: string;
  name: string;
  dataUrl: string;
};

export type DailyProblemPhoto = DailyReportPhoto;

export type DailyProblemIssue = {
  id: string;
  title: string;
  detail: string;
  photos: DailyProblemPhoto[];
};

export type DailyWorkItemStatus = "completed" | "ongoing";

export type DailyWorkItem = {
  id: string;
  title: string;
  status: DailyWorkItemStatus;
};

export type DailyReport = {
  id: string;
  companyId: string;
  projectId: string;
  reportDate: string;
  carryForwardSourceReportId?: string;
  carryForwardSourceDate?: string;
  confirmedChecklistItems?: string[];
  preparedBy: string;
  preparedByPhone: string;
  summary: string;
  workItems: DailyWorkItem[];
  completedWork: string;
  ongoingWork: string;
  problems: string;
  materials: string;
  nextPlan: string;
  customerNote: string;
  internalNote: string;
  workers: DailyWorker[];
  progressUpdates: DailyProgressUpdate[];
  problemIssues: DailyProblemIssue[];
  photos: DailyReportPhoto[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectControlData = {
  companies: Company[];
  activeCompanyId: string;
  projects: Project[];
  activeProjectId: string;
  dailyReports: DailyReport[];
  crews: Crew[];
  laborExpenses: LaborExpense[];
  buyinEntries: BuyinEntry[];
};
