const RATE = 0.075;

function analyzeInvoice(invoiceAmount, termsDays, discountTerms) {
  const estimatedCost = Math.round(invoiceAmount * (termsDays / 365) * RATE * 100) / 100;
  return {
    costOfFloat: { exactPart: { invoiceAmount, termsDays }, rate: RATE, estimatedCost },
    discountForgone: null,
    benchmarkComparison: { isAboveTypical: termsDays > 30, multiple: Math.round((termsDays / 30) * 10) / 10 },
    disclaimers: 'Placeholder math — Person 3 will replace this.'
  };
}

function calcNegotiationImpact(invoiceAmount, currentDays, proposedDays, invoicesPerYear) {
  const freedUpCash = Math.round(invoiceAmount * ((currentDays - proposedDays) / 365) * 100) / 100;
  const currentAnnual = invoiceAmount * (currentDays / 365) * RATE * invoicesPerYear;
  const proposedAnnual = invoiceAmount * (proposedDays / 365) * RATE * invoicesPerYear;
  const annualSavings = Math.round((currentAnnual - proposedAnnual) * 100) / 100;
  return { freedUpCash, annualSavings };
}

function buildLeverageLetter(customerName, invoiceAmount, currentDays, proposedDays, annualSavings) {
  return `Hi — I wanted to revisit our current payment terms (Net ${currentDays}). Moving to Net ${proposedDays} would free up roughly $${annualSavings}/year for both of us to plan around. Would you be open to discussing this for upcoming invoices?`;
}

function rankCustomers(invoices) {
  const totals = {};
  invoices.forEach(inv => {
    totals[inv.customerName] = (totals[inv.customerName] || 0) + (inv.costOfFloat || 0);
  });
  return Object.entries(totals)
    .map(([customerName, totalFloatCost]) => ({ customerName, totalFloatCost }))
    .sort((a, b) => b.totalFloatCost - a.totalFloatCost);
}

module.exports = { analyzeInvoice, calcNegotiationImpact, buildLeverageLetter, rankCustomers };
