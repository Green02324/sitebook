export type Role = "ADMIN" | "USER";
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
  projectId: string;
  categoryId: string | null;
  category?: Category | null;
  type: TransactionType;
  mode: TransactionMode;
  date: string;
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
  projects: DashboardProjectSummary[];
  availableYears: number[];
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
