const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {getFirestore} = require('firebase-admin/firestore');

const normalizeCodeId = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized || null;
};

const resolveMemberCodeId = (memberData) => {
  if (!memberData || typeof memberData !== 'object') {
    return null;
  }

  return normalizeCodeId(memberData.platformCodeId || memberData.platformCode);
};

const applyDelta = async (transaction, db, codeId, delta) => {
  if (!codeId || !delta) return;

  const codeRef = db.collection('platformCodes').doc(codeId);
  const codeSnap = await transaction.get(codeRef);

  if (!codeSnap.exists) {
    return;
  }

  const currentUsage = Number(codeSnap.data()?.usageCount) || 0;
  const nextUsage = Math.max(0, currentUsage + delta);

  if (nextUsage !== currentUsage) {
    transaction.update(codeRef, {usageCount: nextUsage});
  }
};

exports.syncPlatformCodeUsage = onDocumentWritten('members/{memberId}', async (event) => {
  const db = getFirestore();

  const beforeData = event.data?.before?.exists ? event.data.before.data() : null;
  const afterData = event.data?.after?.exists ? event.data.after.data() : null;

  const beforeCodeId = resolveMemberCodeId(beforeData);
  const afterCodeId = resolveMemberCodeId(afterData);

  if (beforeCodeId === afterCodeId) {
    return;
  }

  await db.runTransaction(async (transaction) => {
    await applyDelta(transaction, db, beforeCodeId, -1);
    await applyDelta(transaction, db, afterCodeId, 1);
  });
});
