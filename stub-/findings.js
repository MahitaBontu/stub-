
/**
 * findings.js — assembles calculation results into labeled findings
 * (backs POST /analyze and POST /negotiate). Keeps three categories
 * separate; never produces a single blended "you're owed $X" number.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calculations'));
  else root.Findings = factory(root.Calculations);
})(typeof self !== 'undefined' ? self : this, function (calc) {
  // ASSUMPTION — placeholder days; replace with sourced B2B payment-survey figures.
  const DEFAULT_BENCHMARKS = {
    'general contracting': { low: 30, typical: 45, high: 60 },
    'consulting':          { low: 15, typical: 30, high: 45 },
    'manufacturing':       { low: 30, typical: 45, high: 60 },
  };

  const DISCLAIMERS = [
    'Amount and payment-terms days are read directly from your document.',
    'The dollar cost of float uses an assumed cost-of-capital rate (a benchmark, not your actual borrowing rate); treat it as an estimate.',
    'Industry comparisons are typical ranges, not a recommendation of what your contract should say.',
    'This tool is not legal or financial advice.',
  ];

  /**
   * confirmed: { invoiceAmount, termsDays, discountTerms?, industry?, daysUntilPaid? }
   * opts: { rate?, benchmarks? }
   */
  function analyze(confirmed, opts = {}) {
    const rate = opts.rate ?? calc.DEFAULT_COST_OF_CAPITAL.rate;
    const { invoiceAmount, termsDays } = confirmed;
    const actualDays = confirmed.daysUntilPaid ?? termsDays;

    const dollars = calc.costOfFloat(invoiceAmount, actualDays, rate);
    const discount = calc.discountForgone(invoiceAmount, confirmed.discountTerms, actualDays);
    const benchmark = calc.compareToBenchmark(
      termsDays, confirmed.industry, opts.benchmarks || DEFAULT_BENCHMARKS);

    return {
      costOfFloat: {
        kind: 'benchmark-informed estimate',
        exactInputs: { invoiceAmount, daysUntilPaid: actualDays },
        assumedRate: rate,
        rateSource: calc.DEFAULT_COST_OF_CAPITAL.source,
        estimatedCost: dollars,
      },
      discountForgone: discount && { kind: 'exact (from stated terms)', ...discount },
      benchmarkComparison: benchmark && { kind: 'benchmark estimate', ...benchmark },
      cashFlowRisk: {
        kind: 'structural (not a dollar claim)',
        flag: actualDays > 30,
        note: 'Revenue that arrives late and unpredictably is a risk on its own, separate from the float cost.',
      },
      disclaimers: DISCLAIMERS,
    };
  }

  /** confirmed + { proposedDays, invoicesPerYear, rate? } -> simulator output */
  function negotiate(confirmed, { proposedDays, invoicesPerYear = 1, rate } = {}) {
    return calc.negotiate({
      amount: confirmed.invoiceAmount,
      currentDays: confirmed.daysUntilPaid ?? confirmed.termsDays,
      proposedDays,
      invoicesPerYear,
      rate: rate ?? calc.DEFAULT_COST_OF_CAPITAL.rate,
    });
  }

  // ---------------------------------------------------------------------
  // Drop-in replacements for the placeholder module (same names/signatures)
  // ---------------------------------------------------------------------
  const RATE = 0.075; // ASSUMPTION — replace with a sourced benchmark before the demo
  const TYPICAL_DAYS = 30; // "Net 30 is standard for most trade invoicing" (label as typical, adjustable)
  const money = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function analyzeInvoice(invoiceAmount, termsDays, discountTerms) {
    const estimatedCost = calc.costOfFloat(invoiceAmount, termsDays, RATE);
    const discount = calc.discountForgone(invoiceAmount, discountTerms, termsDays);
    return {
      costOfFloat: { exactPart: { invoiceAmount, termsDays }, rate: RATE, estimatedCost },
      discountForgone: discount && { exact: true, ...discount },
      benchmarkComparison: {
        typicalDays: TYPICAL_DAYS,
        isAboveTypical: termsDays > TYPICAL_DAYS,
        multiple: Math.round((termsDays / TYPICAL_DAYS) * 10) / 10,
      },
      cashFlowRisk: { flag: termsDays > 30, note: 'Late, unpredictable revenue is a risk separate from float cost.' },
      disclaimers: DISCLAIMERS.join(' '),
      disclaimerList: DISCLAIMERS,
    };
  }

  // freedUpCash = average cash no longer tied up in unpaid invoices (steady state).
  function calcNegotiationImpact(invoiceAmount, currentDays, proposedDays, invoicesPerYear) {
    const r = calc.negotiate({
      amount: invoiceAmount, currentDays, proposedDays, invoicesPerYear, rate: RATE,
    });
    return {
      freedUpCash: r.workingCapitalFreed,
      annualSavings: r.annualSavings,
      savingsPerInvoice: r.savingsPerInvoice,
      annualCurrentCost: r.annualCurrentCost,
      daysSaved: r.daysSaved,
    };
  }

  function buildLeverageLetter(customerName, invoiceAmount, currentDays, proposedDays, annualSavings) {
    const greeting = customerName ? `Hi ${customerName} team` : 'Hi';
    if (!(proposedDays < currentDays)) {
      return `${greeting} — I'd like to talk about our payment terms (currently Net ${currentDays}) ahead of upcoming invoices. Do you have time to discuss?`;
    }
    return `${greeting} — I wanted to revisit our current payment terms (Net ${currentDays}). ` +
      `On invoices like our recent $${money(invoiceAmount)} one, waiting ${currentDays} days instead of ${proposedDays} ` +
      `costs us an estimated $${money(annualSavings)}/year in tied-up cash across our regular work together. ` +
      `Moving to Net ${proposedDays} would help us plan and keep serving you reliably. Would you be open to discussing this for upcoming invoices?`;
  }

  // Accepts inv.costOfFloat as a number OR as analyzeInvoice's { estimatedCost } object.
  function rankCustomers(invoices) {
    const totals = {};
    (invoices || []).forEach((inv) => {
      const c = inv.costOfFloat;
      const cost = typeof c === 'number' ? c : (c && c.estimatedCost) || 0;
      totals[inv.customerName] = (totals[inv.customerName] || 0) + cost;
    });
    return Object.entries(totals)
      .map(([customerName, totalFloatCost]) => ({ customerName, totalFloatCost: calc.round2(totalFloatCost) }))
      .sort((a, b) => b.totalFloatCost - a.totalFloatCost);
  }

  return {
    DEFAULT_BENCHMARKS, DISCLAIMERS, analyze, negotiate,
    analyzeInvoice, calcNegotiationImpact, buildLeverageLetter, rankCustomers,
  };
});


/*
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
*/