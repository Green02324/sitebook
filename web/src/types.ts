export type Role = "ADMIN" | "ADMIN_READONLY" | "USER";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ADMIN_READONLY: "Admin (read-only)",
  USER: "User",
};
export type ProjectStatus = "PLANNING" | "ACTIVE" | "COMPLETED";
export type TransactionType = "DEBIT" | "CREDIT";
export type TransactionMode = "ESTIMATE" | "ACTUAL";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: string;
  // Set when the account has been switched off; its data is untouched.
  deactivatedAt: string | null;
}

export interface UserWithProjectCount extends User {
  projectCount: number;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  address: string | null;
  startDate: string | null;
  targetCompletionDate: string | null;
  contractAmountCents: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { transactions: number };
}

export interface Category {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  phase: string | null;
  projectId: string;
  categoryId: string | null;
  category?: Category | null;
  type: TransactionType;
  mode: TransactionMode;
  // Null on estimates, which are organised by phase instead of by date.
  date: string | null;
  amountCents: number;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface DashboardResponse {
  year: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  overheadCents: number;
  projects: DashboardProjectSummary[];
  availableYears: number[];
}

export interface DashboardBreakdown {
  debits: { name: string; amountCents: number }[];
}

export interface ReportLine {
  categoryName: string;
  subtotalCents: number;
}

export interface ReportResponse {
  projectName: string;
  contractorName: string;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  credits: ReportLine[];
  debits: ReportLine[];
  netCents: number;
  profitPct: number | null;
}

export interface ComparisonRow {
  categoryId: string | null;
  categoryName: string;
  estimateDebitCents: number;
  estimateCreditCents: number;
  actualDebitCents: number;
  actualCreditCents: number;
  varianceDebitCents: number;
  varianceCreditCents: number;
}

export interface OverheadCategory {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface OverheadExpense {
  id: string;
  userId: string;
  categoryId: string | null;
  category?: OverheadCategory | null;
  date: string;
  amountCents: number;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnualSummaryProjectLine {
  name: string;
  status: ProjectStatus;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  profitPct: number | null;
}

export interface AnnualSummaryResponse {
  year: number;
  contractorName: string;
  generatedAt: string;
  projects: AnnualSummaryProjectLine[];
  overheadCents: number;
  grandNetCents: number;
}

export interface DetailedTxLine {
  date: string;
  type: TransactionType;
  categoryName: string;
  amountCents: number;
  description: string | null;
}

export interface AnnualDetailedResponse {
  year: number;
  contractorName: string;
  generatedAt: string;
  projects: { name: string; transactions: DetailedTxLine[] }[];
  overhead: DetailedTxLine[];
}

export interface LedgerLine {
  date: string;
  source: string;
  categoryName: string;
  amountCents: number;
}

export interface AnnualLedgerResponse {
  year: number;
  contractorName: string;
  generatedAt: string;
  credits: LedgerLine[];
  debits: LedgerLine[];
  totalCredits: number;
  totalDebits: number;
  netCents: number;
}
