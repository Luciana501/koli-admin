const admin = require('firebase-admin');
const functions = require('firebase-functions');

const db = admin.firestore();

async function resolveAuth(data, context) {
  functions.logger.info('kashCashouts auth check', {
    hasContextAuth: !!(context && context.auth && context.auth.uid),
    authUid: context?.auth?.uid || null,
    hasIdToken: typeof data?.idToken === 'string' && data.idToken.length > 0,
  });
  if (context.auth && context.auth.uid) {
    return context.auth.uid;
  }

  const idToken = data?.idToken;
  if (typeof idToken === 'string' && idToken.length > 0) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      return decoded.uid;
    } catch (error) {
      functions.logger.warn('Invalid idToken for callable cashout function', {
        message: error?.message || 'unknown',
      });
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
    }
  }

  throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
}

exports.startFiatExchange = functions.https.onCall(async (data, context) => {
  const callerUid = await resolveAuth(data, context);
  functions.logger.info('startFiatExchange called', { callerUid, requestId: data?.requestId || null });
  const requestId = data?.requestId;
  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId');
  }

  const cashoutRef = db.collection('kashCashouts').doc(requestId);
  const snap = await cashoutRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Cashout not found');
  }

  await cashoutRef.set(
    {
      status: 'FIAT_EXCHANGING',
      fiatStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { ok: true };
});

exports.completeKashCashout = functions.https.onCall(async (data, context) => {
  const callerUid = await resolveAuth(data, context);
  functions.logger.info('completeKashCashout called', { callerUid, requestId: data?.requestId || null });
  const requestId = data?.requestId;
  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId');
  }

  const cashoutRef = db.collection('kashCashouts').doc(requestId);
  const snap = await cashoutRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Cashout not found');
  }

  const dataDoc = snap.data() || {};
  const firebaseUid = String(dataDoc.firebaseUid || '');
  const amount = Number(dataDoc.amount || 0);
  if (!firebaseUid || !Number.isFinite(amount)) {
    throw new functions.https.HttpsError('failed-precondition', 'Invalid cashout data');
  }

  await cashoutRef.set(
    {
      status: 'APPROVED',
      fiatApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const txRef = db.collection('kashTransactions').doc();
  await txRef.set({
    id: txRef.id,
    kashAccountId: dataDoc.walletId || null,
    firebaseUid,
    email: dataDoc.email || null,
    displayName: dataDoc.displayName || null,
    walletPublicKey: dataDoc.walletPublicKey || null,
    direction: 'DEBIT',
    type: 'KASH_CASHOUT',
    sourceApp: 'K_KASH',
    amount,
    balanceAfter: null,
    txHash: dataDoc.txHash || null,
    reference: requestId,
    status: 'COMPLETED',
    metadata: {
      cashoutRequestId: requestId,
      channelId: dataDoc.channelId || null,
      channelLabel: dataDoc.channelLabel || null,
      channelType: dataDoc.channelType || null,
      stage: 'fiat_exchange_completed',
    },
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
});

exports.rejectKashCashout = functions.https.onCall(async (data, context) => {
  const callerUid = await resolveAuth(data, context);
  functions.logger.info('rejectKashCashout called', { callerUid, requestId: data?.requestId || null });
  const requestId = data?.requestId;
  if (!requestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing requestId');
  }

  const reason = typeof data?.reason === 'string' ? data.reason : 'Rejected by fiat admin';
  const cashoutRef = db.collection('kashCashouts').doc(requestId);
  const snap = await cashoutRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Cashout not found');
  }

  await cashoutRef.set(
    {
      status: 'REJECTED',
      rejectionReason: reason || 'Rejected by fiat admin',
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return { ok: true };
});