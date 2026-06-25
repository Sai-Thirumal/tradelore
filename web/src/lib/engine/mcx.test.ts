import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichMcxMetadata,
  extractMcxInstrumentName,
  getContractValue,
  getMcxFamilyLabel,
  getMcxSessionCloseMinutes,
  getMcxYahooSymbol,
} from './mcx.ts';

test('extracts MCX futures and options contract families', () => {
  assert.equal(extractMcxInstrumentName('GOLD26AUGFUT'), 'GOLD');
  assert.equal(extractMcxInstrumentName('COPPER26JUL1210CE'), 'COPPER');
});

test('uses contract-value multipliers for major MCX products', () => {
  assert.equal(enrichMcxMetadata('GOLD26AUGFUT', {}).priceMultiplier, 100);
  assert.equal(enrichMcxMetadata('SILVER26JULFUT', {}).priceMultiplier, 30);
  assert.equal(enrichMcxMetadata('CRUDEOILM26JULFUT', {}).priceMultiplier, 10);
  assert.equal(getContractValue(1, 100_000, 100), 10_000_000);
});

test('groups variants under commodity families and maps reference charts', () => {
  assert.equal(getMcxFamilyLabel('GOLDM26JULFUT'), 'Gold');
  assert.equal(getMcxFamilyLabel('SILVERMIC26JUNFUT'), 'Silver');
  assert.equal(getMcxYahooSymbol('GOLDM'), 'GC=F');
});

test('marks unknown MCX contracts as estimated', () => {
  const metadata = enrichMcxMetadata('UNKNOWN26JULFUT', {});
  assert.equal(metadata.calculationStatus, 'estimated');
  assert.equal(metadata.priceMultiplier, 1);
  assert.ok(metadata.warnings.length > 0);
});

test('uses the MCX daylight-saving evening close schedule', () => {
  assert.equal(getMcxSessionCloseMinutes(new Date(2026, 0, 15)), 23 * 60 + 30);
  assert.equal(getMcxSessionCloseMinutes(new Date(2026, 5, 15)), 23 * 60 + 55);
});
