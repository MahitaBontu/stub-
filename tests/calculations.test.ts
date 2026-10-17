import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInvoice, calcNegotiationImpact, rankCustomers } from '../findings';

test('invoice cost estimate uses invoice × days/365 × annual rate', () => {
  const result = analyzeInvoice(8400, 75, null, 0.12);
  assert.equal(result.costOfFloat.estimatedCost, 207.12);
  assert.equal(result.costOfFloat.rate, 0.12);
});

test('Net 75 to Net 30 saves 45 days and $124.27 per invoice at 12%', () => {
  const result = calcNegotiationImpact(8400, 75, 30, 12, 0.12);
  assert.equal(result.daysAccelerated, 45);
  assert.equal(result.financingCostAvoided, 124.27);
  assert.equal(result.annualSavings, 1491.29);
  assert.equal(result.freedUpCash, 8400);
});

test('longer proposed terms can have a negative benefit', () => {
  const result = calcNegotiationImpact(8400, 30, 75, 1, 0.12);
  assert.equal(result.daysAccelerated, -45);
  assert.equal(result.financingCostAvoided, -124.27);
  assert.equal(result.freedUpCash, 0);
});

test('invalid values are rejected rather than silently used', () => {
  assert.throws(() => analyzeInvoice(0, 75), /positive/);
  assert.throws(() => calcNegotiationImpact(8400, 75, -20), /0 to 365/);
  assert.throws(() => calcNegotiationImpact(8400, 75, 30, 1, 12), /decimal/);
});

test('customer ranking correctly aggregates repeated invoices', () => {
  assert.deepEqual(rankCustomers([
    { customerName: 'Alpha', costOfFloat: 20 },
    { customerName: 'Beta', costOfFloat: 30 },
    { customerName: 'Alpha', costOfFloat: 15 }
  ]), [
    { customerName: 'Alpha', totalFloatCost: 35 },
    { customerName: 'Beta', totalFloatCost: 30 }
  ]);
});

