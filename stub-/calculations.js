/**
 * calculations.js — pure math for Stub. No I/O, no AI, no dependencies.
 * Works in Node (require) and the browser (window.Calculations).
 *
 * Convention: every function takes plain numbers, returns plain numbers
 * (dollars rounded to cents), and throws on invalid input so bad data
 * never silently becomes a confident-looking dollar figure.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calculations = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DAYS_PER_YEAR = 365;

  // ASSUMPTION — replace with a sourced figure before the demo
  // (e.g. SBA / Fed Small Business Credit Survey average) and fill in `source`.
  const DEFAULT_COST_OF_CAPITAL = {
    rate: 0.10,
    source: 'PLACEHOLDER — cite SBA or Fed small-business lending survey here',
  };

  const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

  function assertNonNegative(name, v) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`${name} must be a non-negative finite number, got ${v}`);
    }
  }

  /**
   * Cost of float: what it costs to wait `days` for `amount`.
   * amount × (days / 365) × rate
   */
  function costOfFloat(amount, days, rate = DEFAULT_COST_OF_CAPITAL.rate) {
    assertNonNegative('amount', amount);
    assertNonNegative('days', days);
    assertNonNegative('rate', rate);
    return round2(amount * (days / DAYS_PER_YEAR) * rate);
  }

  /**
   * Negotiation simulator math.
   *
   * Note: this deliberately differs from the spec's `amount × (Δdays/365)`,
   * which is dimensionally "dollar-years" and has no rate in it. Two honest
   * numbers instead:
   *  - savingsPerInvoice: value of getting the cash Δdays sooner, at the rate.
   *  - workingCapitalFreed: with N invoices/yr, average money sitting in
   *    unpaid invoices drops by amount × N × Δdays / 365 (steady state).
   */
  function negotiate({ amount, currentDays, proposedDays, invoicesPerYear = 1, rate = DEFAULT_COST_OF_CAPITAL.rate }) {
    assertNonNegative('amount', amount);
    assertNonNegative('currentDays', currentDays);
    assertNonNegative('proposedDays', proposedDays);
    assertNonNegative('invoicesPerYear', invoicesPerYear);

    const daysSaved = currentDays - proposedDays; // negative if "proposal" is worse
    const currentCost = costOfFloat(amount, currentDays, rate);
    const proposedCost = costOfFloat(amount, proposedDays, rate);
    const savingsPerInvoice = round2(currentCost - proposedCost);

    return {
      daysSaved,
      currentCostPerInvoice: currentCost,
      proposedCostPerInvoice: proposedCost,
      savingsPerInvoice,
      annualCurrentCost: round2(currentCost * invoicesPerYear),
      annualSavings: round2(savingsPerInvoice * invoicesPerYear),
      workingCapitalFreed: round2(amount * invoicesPerYear * (daysSaved / DAYS_PER_YEAR)),
    };
  }

  /**
   * Parse stated discount terms like "2/10 Net 30" or "1.5/15 net 45".
   * Returns null when absent/unparseable — never guesses.
   */
  function parseDiscountTerms(text) {
    if (typeof text !== 'string') return null;
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:%\s*)?\/\s*(\d+)\s*,?\s*net\s*(\d+)/i);
    if (!m) return null;
    const pct = parseFloat(m[1]);
    const discountDays = parseInt(m[2], 10);
    const netDays = parseInt(m[3], 10);
    if (!(pct > 0 && pct < 100) || discountDays >= netDays) return null;
    return { pct, discountDays, netDays };
  }

  /**
   * Discount forgone. Exact math from stated terms, no assumed rate.
   * `daysUntilPaid` = how long the customer actually takes (or the stated terms).
   * Returns null if no terms or the discount window was actually met.
   * Also returns the implied annualized rate of skipping the discount
   * (2/10 net 30 ≈ 37%) — a fact about the terms, not an estimate.
   */
  function discountForgone(amount, termsText, daysUntilPaid) {
    assertNonNegative('amount', amount);
    assertNonNegative('daysUntilPaid', daysUntilPaid);
    const t = parseDiscountTerms(termsText);
    if (!t) return null;
    if (daysUntilPaid <= t.discountDays) return null;

    const impliedAnnualRate =
      (t.pct / (100 - t.pct)) * (DAYS_PER_YEAR / (t.netDays - t.discountDays));

    return {
      terms: t,
      dollarsForgone: round2(amount * (t.pct / 100)),
      impliedAnnualRate: Math.round(impliedAnnualRate * 1000) / 1000,
    };
  }

  /**
   * Benchmark comparison. `benchmarks` is a { industry: { low, typical, high } }
   * table in days. Estimates only; the caller supplies/sources the table.
   */
  function compareToBenchmark(termsDays, industry, benchmarks) {
    assertNonNegative('termsDays', termsDays);
    const key = typeof industry === 'string' ? industry.trim().toLowerCase() : '';
    const b = benchmarks && benchmarks[key];
    if (!b) return null;
    return {
      industry: key,
      typicalDays: b.typical,
      typicalRange: [b.low, b.high],
      daysBeyondTypical: Math.max(0, termsDays - b.typical),
      withinTypicalRange: termsDays >= b.low && termsDays <= b.high,
    };
  }

  /**
   * Buffer series (P1): receive payments `termsDays` late; hold back
   * `bufferPct` of each month's income so cash flow stays smooth.
   * `monthlyInvoices`: array of invoice totals billed per month.
   * Returns month-by-month buffer balance and the amount released.
   */
  function bufferSeries(monthlyInvoices, bufferPct) {
    if (!Array.isArray(monthlyInvoices)) throw new TypeError('monthlyInvoices must be an array');
    assertNonNegative('bufferPct', bufferPct);
    if (bufferPct > 1) throw new RangeError('bufferPct is a fraction between 0 and 1');
    let balance = 0;
    return monthlyInvoices.map((amt, i) => {
      assertNonNegative('monthlyInvoices[' + i + ']', amt);
      const held = round2(amt * bufferPct);
      balance = round2(balance + held);
      return { month: i + 1, billed: amt, held, bufferBalance: balance };
    });
  }

  return {
    DAYS_PER_YEAR,
    DEFAULT_COST_OF_CAPITAL,
    round2,
    costOfFloat,
    negotiate,
    parseDiscountTerms,
    discountForgone,
    compareToBenchmark,
    bufferSeries,
  };
});