/** Stub financial findings and negotiation estimates.
 * The default rate and industry ranges are illustrative assumptions.
 */

export interface ConfirmedInvoice {
  invoiceAmount: number;
  termsDays: number;
  daysUntilPaid?: number;
  discountTerms?: string | null;
  industry?: string;
}

export interface BenchmarkRange {
  low: number;
  typical: number;
  high: number;
}

export type BenchmarkTable = Record<string, BenchmarkRange>;

export interface AnalyzeOptions {
  rate?: number;
  benchmarks?: BenchmarkTable;
}

export interface NegotiateOptions {
  proposedDays: number;
  invoicesPerYear?: number;
  rate?: number;
}

export interface CustomerInvoice {
  customerName: string;
  costOfFloat: number | { estimatedCost: number };
}

export const DEFAULT_BENCHMARKS: BenchmarkTable = {
  'general contracting': { low: 30, typical: 45, high: 60 },
  consulting: { low: 15, typical: 30, high: 45 },
  manufacturing: { low: 30, typical: 45, high: 60 }
};

export const DISCLAIMERS = [
  'Invoice amount and stated payment terms come from the document and should be confirmed.',
  'Financing cost is an estimate using an assumed rate, not a proven expense.',
  'Industry payment-term ranges are illustrative until verified with sources.',
  'This is not financial or legal advice.'
];

const RATE = 0.095; // Illustrative annual rate, not a verified industry benchmark.
const TYPICAL_DAYS = 30; // Illustrative comparison, not a universal industry standard.
const RATE_SOURCE = 'Illustrative user-adjustable rate (not a verified benchmark)';

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validate(amount: number, days: number, rate: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invoice amount must be positive.');
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    throw new Error('Days must be an integer between 0 and 365.');
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error('Annual rate must be a decimal between 0 and 1.');
  }
}

function costOfFloat(amount: number, days: number, rate: number): number {
  validate(amount, days, rate);
  return round2(amount * (days / 365) * rate);
}

function negotiateTerms(
  amount: number,
  currentDays: number,
  proposedDays: number,
  invoicesPerYear: number,
  rate: number
) {
  validate(amount, currentDays, rate);
  validate(amount, proposedDays, rate);
  if (!Number.isInteger(invoicesPerYear) || invoicesPerYear < 1) {
    throw new Error('Invoices per year must be a positive integer.');
  }
  
  const daysSaved = currentDays - proposedDays;
  const savingsPerInvoice = round2(amount * (daysSaved / 365) * rate);
  const annualSavings = round2(amount * (daysSaved / 365) * rate * invoicesPerYear);
  const annualCurrentCost = round2(amount * (currentDays / 365) * rate * invoicesPerYear);
  // Average receivables reduced if invoices are evenly distributed over the year.
  const workingCapitalFreed = round2(amount * invoicesPerYear * daysSaved / 365);

  return { daysSaved, savingsPerInvoice, annualSavings, annualCurrentCost, workingCapitalFreed };
}

/** More detailed analysis; optional industry ranges are illustrations, not verified market facts. */
export function analyze(confirmed: ConfirmedInvoice, opts: AnalyzeOptions = {}) {
  const rate = opts.rate ?? RATE;
  const { invoiceAmount, termsDays } = confirmed;
  const actualDays = confirmed.daysUntilPaid ?? termsDays;
  validate(invoiceAmount, actualDays, rate);

  const ranges = opts.benchmarks ?? DEFAULT_BENCHMARKS;
  const benchmark = confirmed.industry ? ranges[confirmed.industry.toLowerCase()] ?? null : null;
  return {
    costOfFloat: {
      kind: 'assumption-based estimate',
      exactInputs: { invoiceAmount, daysUntilPaid: actualDays },
      assumedRate: rate,
      rateSource: RATE_SOURCE,
      estimatedCost: costOfFloat(invoiceAmount, actualDays, rate)
    },
    // Offering an early-payment discount doesn't mean the vendor has lost it.
    discountForgone: null,
    benchmarkComparison: benchmark && {
      kind: 'illustrative range (not a verified industry benchmark)',
      ...benchmark,
      isAboveTypical: termsDays > benchmark.typical
    },
    cashFlowRisk: {
      kind: 'structural (not a dollar claim)',
      flag: actualDays > 30,
      note: 'Delayed or unpredictable payments can add cash-flow risk.'
    },
    disclaimers: DISCLAIMERS
  };
}

export function negotiate(confirmed: ConfirmedInvoice, options: NegotiateOptions) {
  return negotiateTerms(
    confirmed.invoiceAmount,
    confirmed.daysUntilPaid ?? confirmed.termsDays,
    options.proposedDays,
    options.invoicesPerYear ?? 1,
    options.rate ?? RATE
  );
}

/** Backward-compatible response shape expected by /analyze. */
export function analyzeInvoice(
  invoiceAmount: number,
  termsDays: number,
  discountTerms: string | null = null
) {
  const estimatedCost = costOfFloat(invoiceAmount, termsDays, RATE);
  return {
    costOfFloat: {
      exactPart: { invoiceAmount, termsDays },
      rate: RATE,
      estimatedCost,
      rateSource: RATE_SOURCE
    },
    discountForgone: null,
    discountTerms,
    benchmarkComparison: {
      typicalDays: TYPICAL_DAYS,
      isAboveTypical: termsDays > TYPICAL_DAYS,
      multiple: round2(termsDays / TYPICAL_DAYS),
      kind: 'illustrative; not an established industry standard'
    },
    cashFlowRisk: {
      flag: termsDays > 30,
      note: 'Delayed, unpredictable revenue can add risk separate from financing cost.'
    },
    disclaimers: DISCLAIMERS.join(' '),
    disclaimerList: DISCLAIMERS
  };
}

/** Backward-compatible response shape expected by /negotiate. */
export function calcNegotiationImpact(
  invoiceAmount: number,
  currentDays: number,
  proposedDays: number,
  invoicesPerYear: number
) {
  const result = negotiateTerms(invoiceAmount, currentDays, proposedDays, invoicesPerYear, RATE);
  return {
    freedUpCash: result.workingCapitalFreed,
    annualSavings: result.annualSavings,
    savingsPerInvoice: result.savingsPerInvoice,
    annualCurrentCost: result.annualCurrentCost,
    daysSaved: result.daysSaved
  };
}

const money = (value: number): string => value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function buildLeverageLetter(
  customerName: string,
  invoiceAmount: number,
  currentDays: number,
  proposedDays: number,
  annualSavings: number
): string {
  const greeting = customerName ? `Hi ${customerName} team` : 'Hi';
  if (proposedDays >= currentDays) {
    return `${greeting} — I'd like to discuss our current Net ${currentDays} payment terms for future invoices.`;
  }
  return `${greeting} — I'd like to revisit our Net ${currentDays} payment terms. ` +
    `On invoices similar to our recent $${money(invoiceAmount)} invoice, ` +
    `moving to Net ${proposedDays} could reduce our modeled annual financing cost by ` +
    `approximately $${money(annualSavings)} under our assumptions. ` +
    `Would you be open to discussing revised terms for upcoming invoices?`;
}

export function rankCustomers(invoices: CustomerInvoice[]) {
  const totals: Record<string, number> = {};
  invoices.forEach((invoice) => {
    const item = invoice.costOfFloat;
    const cost = typeof item === 'number' ? item : item?.estimatedCost ?? 0;
    const name = invoice.customerName || 'Unknown customer';
    if (Number.isFinite(cost)) totals[name] = (totals[name] ?? 0) + cost;
  });
  return Object.entries(totals)
    .map(([customerName, totalFloatCost]) => ({ customerName, totalFloatCost: round2(totalFloatCost) }))
    .sort((a, b) => b.totalFloatCost - a.totalFloatCost);
}