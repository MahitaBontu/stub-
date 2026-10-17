/**
 * retrieve.ts — the "R" in RAG.
 * No embeddings/vector DB: with a handful of invoices per demo session,
 * a scored filter over structured fields IS the retrieval step. It finds
 * which past invoices are relevant to the customer/industry being
 * negotiated, so the generated letter/analysis is grounded in real
 * history instead of one invoice in isolation.
 */

export interface ScannedInvoice {
  customerName: string;
  invoiceAmount: number;
  termsDays: number;
  costOfFloat: number;
  industry?: string;
  daysUntilPaid?: number;
}

export interface RetrievedContext {
  matchedInvoices: ScannedInvoice[];
  summary: string;
}

/**
 * Pulls the invoices most relevant to this customer/industry out of
 * everything scanned so far this session, most-relevant first.
 */
export function retrieveRelevantInvoices(
  allInvoices: ScannedInvoice[],
  customerName: string,
  industry?: string
): RetrievedContext {
  const scored = allInvoices
    .map((inv) => {
      let score = 0;
      if (inv.customerName?.toLowerCase() === customerName?.toLowerCase()) score += 2;
      if (industry && inv.industry?.toLowerCase() === industry.toLowerCase()) score += 1;
      return { inv, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const matchedInvoices = scored.map((s) => s.inv);

  if (matchedInvoices.length === 0) {
    return { matchedInvoices: [], summary: 'No prior invoice history for this customer yet.' };
  }

  const sameCustomer = matchedInvoices.filter(
    (inv) => inv.customerName?.toLowerCase() === customerName?.toLowerCase()
  );
  const avgTerms =
    sameCustomer.reduce((sum, inv) => sum + inv.termsDays, 0) / sameCustomer.length;
  const totalFloatCost = sameCustomer.reduce((sum, inv) => sum + inv.costOfFloat, 0);

  const summary = `${sameCustomer.length} prior invoice${sameCustomer.length === 1 ? '' : 's'} on file for ${customerName}, averaging ${Math.round(avgTerms)}-day terms and $${totalFloatCost.toFixed(2)} in total cost-of-float so far.`;

  return { matchedInvoices, summary };
}
