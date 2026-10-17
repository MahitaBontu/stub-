const NESSIE_API_KEY = process.env.NESSIE_API_KEY;

async function recordDeposit(accountId, amount) {
  if (!NESSIE_API_KEY || !accountId) {
    return { success: true, mode: 'local', amount };
  }
  const url = `http://api.nessieisreal.com/accounts/${accountId}/deposits?key=${NESSIE_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medium: 'balance',
      transaction_date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      description: 'Buffer deposit',
      amount
    })
  });
  if (!response.ok) return { success: true, mode: 'local-fallback', amount };
  const data = await response.json();
  return { success: true, mode: 'nessie', amount, data };
}

module.exports = { recordDeposit };