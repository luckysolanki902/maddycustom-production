const { test, expect } = require('@playwright/test');
const path = require('path');

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = 'mongodb://localhost:27017/playwright-tests';
}

const responseProcessorPath = path.resolve(__dirname, '..', 'src', 'lib', 'payments', 'payu', 'responseProcessor.js');
const { normalisePayuStatus, buildPayuOrderUpdate } = require(responseProcessorPath);

test.describe('PayU response processor helpers', () => {
  test('normalisePayuStatus prioritises known success and failure statuses', () => {
    expect(normalisePayuStatus('captured', 'success')).toBe('success');
    expect(normalisePayuStatus('user_cancelled', 'bounced')).toBe('failure');
  });

  test('normalisePayuStatus falls back to raw status or pending', () => {
    expect(normalisePayuStatus('awaited', '')).toBe('awaited');
    expect(normalisePayuStatus('', '')).toBe('pending');
  });

  test('buildPayuOrderUpdate zeros out due amount when payment succeeds', () => {
    const orderDoc = {
      paymentStatus: 'pending',
      paymentDetails: {
        amountPaidOnline: 0,
        amountDueOnline: 1500,
        amountDueCod: 0,
        payuDetails: { txnId: 'TXN123' },
      },
    };

    const payload = { status: 'captured', mihpayid: 'mih123' };
    const { update } = buildPayuOrderUpdate(orderDoc, payload, 'success');
    expect(update['paymentDetails.amountPaidOnline']).toBe(1500);
    expect(update['paymentDetails.amountDueOnline']).toBe(0);
    expect(update.paymentStatus).toBe('allPaid');
  });

  test('buildPayuOrderUpdate keeps COD outstanding status when only online amount succeeds', () => {
    const orderDoc = {
      paymentStatus: 'pending',
      paymentDetails: {
        amountPaidOnline: 200,
        amountDueOnline: 1300,
        amountDueCod: 500,
        payuDetails: { txnId: 'TXN999' },
      },
    };

    const payload = { status: 'captured', mihpayid: 'mih999', payuid: 'payu999' };
    const { update } = buildPayuOrderUpdate(orderDoc, payload, 'success');
    expect(update['paymentDetails.amountPaidOnline']).toBe(1500);
    expect(update['paymentDetails.amountDueOnline']).toBe(0);
    expect(update.paymentStatus).toBe('paidPartially');
    expect(update['paymentDetails.payuDetails.mihpayid']).toBe('mih999');
  });

  test('buildPayuOrderUpdate preserves dues when payment fails', () => {
    const orderDoc = {
      paymentStatus: 'pending',
      paymentDetails: {
        amountPaidOnline: 0,
        amountDueOnline: 1500,
        amountDueCod: 0,
        payuDetails: { txnId: 'TXN321' },
      },
    };

    const payload = { status: 'failure', mihpayid: 'mih321' };
    const { update } = buildPayuOrderUpdate(orderDoc, payload, 'failure');
    expect(update['paymentDetails.amountPaidOnline']).toBe(0);
    expect(update['paymentDetails.amountDueOnline']).toBe(1500);
    expect(update.paymentStatus).toBe('failed');
  });
});
