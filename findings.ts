/** Deterministic financial estimates. Rates below are assumptions, not benchmarks. */
export const DEFAULT_ANNUAL_RATE = 0.075;

export interface CustomerInvoice {
  customerName: string;
  costOfFloat?: number;
}

function requireAmount(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
}

function requireDays(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 365) {
    throw new Error(`${label} must be an integer from 0 to 365.`);
  }
}

function requireRate(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('Annual rate must be a decimal between 0 and 1 (e.g. 0.075 for 7.5%).');
  }
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Time-value estimate, not a proven expense and not additional invoice revenue. */
export function analyzeInvoice(
  invoiceAmount: number,
  termsDays: number,
  discountTerms: string | null = null,
  annualRate: number = DEFAULT_ANNUAL_RATE
) {
  requireAmount(invoiceAmount, 'Invoice amount');
  requireDays(termsDays, 'Payment term');
  requireRate(annualRate);

  const estimatedCost = money(invoiceAmount * (termsDays / 365) * annualRate);
  return {
    costOfFloat: {
      exactPart: { invoiceAmount, termsDays },
      rate: annualRate,
      estimatedCost,
      rateSource: 'user-entered or illustrative assumption (not a verified market benchmark)'
    },
    // A 2/10 Net 30 clause is a discount OFFERED by the seller, not a loss to
    // the seller when the customer declines it. Compare discounts in a later feature.
    discountForgone: null,
    discountTerms,
    benchmarkComparison: null,
    disclaimers: 'Modeled simple-interest financing cost. Actual cost depends on whether you borrow, your rate, and actual payment timing.'
  };
}

/**
 * Compare current versus proposed payment terms for equal-value invoices.
 * `freedUpCash` is the full invoice amount available earlier IF the payment
 * moves earlier; it is NOT newly earned revenue or the financing savings.
 */
export function calcNegotiationImpact(
  invoiceAmount: number,
  currentDays: number,
  proposedDays: number,
  invoicesPerYear: number = 1,
  annualRate: number = DEFAULT_ANNUAL_RATE
) {
  requireAmount(invoiceAmount, 'Invoice amount');
  requireDays(currentDays, 'Current payment term');
  requireDays(proposedDays, 'Proposed payment term');
  requireRate(annualRate);
  if (!Number.isInteger(invoicesPerYear) || invoicesPerYear < 1 || invoicesPerYear > 10000) {
    throw new Error('Invoices per year must be an integer from 1 to 10000.');
  }

  const daysAccelerated = currentDays - proposedDays;
  const financingCostAvoided = money(invoiceAmount * (daysAccelerated / 365) * annualRate);
  const annualSavings = money(invoiceAmount * (daysAccelerated / 365) * annualRate * invoicesPerYear);
  return {
    daysAccelerated,
    freedUpCash: daysAccelerated > 0 ? invoiceAmount : 0,
    financingCostAvoided,
    annualSavings,
    invoicesPerYear,
    annualRate,
    explanation: 'freedUpCash is invoice principal received sooner, not additional revenue; annualSavings is an estimate under the stated assumptions.'
  };
}

export function buildLeverageLetter(
  customerName: string,
  invoiceAmount: number,
  currentDays: number,
  proposedDays: number,
  annualSavings: number
): string {
  requireAmount(invoiceAmount, 'Invoice amount');
  requireDays(currentDays, 'Current payment term');
  requireDays(proposedDays, 'Proposed payment term');
  if (!Number.isFinite(annualSavings)) throw new Error('Annual estimate is invalid.');
  const name = customerName.trim() || 'your team';
  return `Hello ${name},\n\nCould we revisit the payment terms on our upcoming invoices? Moving from Net ${currentDays} to Net ${proposedDays} on invoices of approximately $${invoiceAmount.toFixed(2)} would shorten our cash-conversion cycle. Based on our stated financing assumptions, the modeled annual cost difference is approximately $${annualSavings.toFixed(2)}. Would you be open to discussing a revised schedule or partial upfront payment?\n\nThank you.`;
}

export function rankCustomers(invoices: CustomerInvoice[]) {
  const totals: Record<string, number> = {};
  for (const inv of invoices) {
    const name = inv.customerName?.trim() || 'Unknown customer';
    const cost = inv.costOfFloat ?? 0;
    if (!Number.isFinite(cost)) continue;
    totals[name] = (totals[name] ?? 0) + cost;
  }
  return Object.entries(totals)
    .map(([customerName, totalFloatCost]) => ({ customerName, totalFloatCost: money(totalFloatCost) }))
    .sort((a, b) => b.totalFloatCost - a.totalFloatCost);
}
