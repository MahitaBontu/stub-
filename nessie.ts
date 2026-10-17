/** Optional mock-bank integration. No Nessie connection is needed for the core MVP. */
export interface DepositResult {
  success: boolean;
  mode: 'local' | 'local-fallback' | 'nessie';
  amount: number;
  simulated: boolean;
  data?: unknown;
}

export async function recordDeposit(accountId: string, amount: number): Promise<DepositResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Deposit amount must be positive.');
  }

  const apiKey = process.env.NESSIE_API_KEY;
  if (!apiKey || !accountId) {
    return { success: true, mode: 'local', amount, simulated: true };
  }

  // Optional sponsor API; errors are reported as simulation fallbacks.
  const url = `http://api.nessieisreal.com/accounts/${encodeURIComponent(accountId)}/deposits?key=${encodeURIComponent(apiKey)}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medium: 'balance',
        transaction_date: new Date().toISOString().slice(0, 10),
        status: 'completed',
        description: 'Buffer deposit',
        amount
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return { success: true, mode: 'local-fallback', amount, simulated: true };
    return { success: true, mode: 'nessie', amount, simulated: true, data: await response.json() };
  } catch {
    return { success: true, mode: 'local-fallback', amount, simulated: true };
  }
}
