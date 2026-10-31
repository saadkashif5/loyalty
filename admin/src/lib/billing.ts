// Shapes returned by the billing API, shared by the console's billing pages.

export interface PlanLimits {
  branches: number | null;
  programs: number | null;
  stampers: number | null;
  staff: number | null;
  customers: number | null;
}

export interface Plan {
  _id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthlyPkr: number;
  priceAnnualPkr: number;
  limits: PlanLimits;
  isActive: boolean;
  isPublic: boolean;
  version: number;
}

export interface SubscriptionInfo {
  status: string;
  billingCycle: "MONTHLY" | "ANNUAL";
  plan: {
    code: string;
    name: string;
    version: number;
    priceMonthlyPkr: number;
    priceAnnualPkr: number;
    limits: PlanLimits;
  };
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  suspendedAt: string | null;
}

export interface PaymentInfo {
  _id: string;
  amountPkr: number;
  method: string;
  reference?: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

export interface InvoiceInfo {
  _id: string;
  number: string;
  status: "ISSUED" | "PAID" | "VOID";
  issuedAt: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  totalPkr: number;
  discountPercent: number;
  voidReason?: string;
}

export interface BillingSummary {
  subscription: (SubscriptionInfo & { discountPercent?: number }) | null;
  nextPaymentPkr: number | null;
  openInvoice: InvoiceInfo | null;
  invoices: InvoiceInfo[];
  usage: Record<keyof PlanLimits, number>;
  payments: PaymentInfo[];
  plans: Plan[];
}

export const LIMIT_LABELS: Array<[keyof PlanLimits, string]> = [
  ["branches", "Branches"],
  ["programs", "Active programs"],
  ["stampers", "Active stampers"],
  ["staff", "Staff"],
  ["customers", "Customers"],
];

export const PAYMENT_METHODS: Array<[string, string]> = [
  ["BANK_TRANSFER", "Bank transfer"],
  ["RAAST", "Raast"],
  ["CASH", "Cash"],
  ["CHEQUE", "Cheque"],
  ["CARD", "Card"],
  ["OTHER", "Other"],
];
