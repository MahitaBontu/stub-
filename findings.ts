const RATE = 0.075;

export function analyzeInvoice(invoiceAmount: number, termsDays: number, discountTerms: string | null) {
  const estimatedCost = Math.round(invoiceAmount * (termsDays / 365) * RATE * 100) / 100;
  return {
    costOfFloat: { exactPart: { invoiceAmount, termsDays }, rate: RATE, estimatedCost },
    discountForgone: null,
    benchmarkComparison: { isAboveTypical: termsDays > 30, multiple: Math.round((termsDays / 30) * 10) / 10 },
    disclaimers: 'Placeholder math — Person 3 will replace this.'
  };
}

export function calcNegotiationImpact(invoiceAmount: number, currentDays: number, proposedDays: number, invoicesPerYear: number) {
  const freedUpCash = Math.round(invoiceAmount * ((currentDays - proposedDays) / 365) * 100) / 100;
  const currentAnnual = invoiceAmount * (currentDays / 365) * RATE * invoicesPerYear;
  const proposedAnnual = invoiceAmount * (proposedDays / 365) * RATE * invoicesPerYear;
  const annualSavings = Math.round((currentAnnual - proposedAnnual) * 100) / 100;
  return { freedUpCash, annualSavings };
}

export function buildLeverageLetter(customerName: string, invoiceAmount: number, currentDays: number, proposedDays: number, annualSavings: number) {
  return `Hi — I wanted to revisit our current payment terms (Net ${currentDays}). Moving to Net ${proposedDays} would free up roughly $${annualSavings}/year for both of us to plan around. Would you be open to discussing this for upcoming invoices?`;
}

interface ScannedInvoice {
  customerName: string;
  invoiceAmount: number;
  termsDays: number;
  costOfFloat: number;
}

export function rankCustomers(invoices: ScannedInvoice[]) {
  const totals: Record<string, number> = {};
  invoices.forEach(inv => {
    totals[inv.customerName] = (totals[inv.customerName] || 0) + (inv.costOfFloat || 0);
  });
  return Object.entries(totals)
    .map(([customerName, totalFloatCost]) => ({ customerName, totalFloatCost }))
    .sort((a, b) => b.totalFloatCost - a.totalFloatCost);
}