const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');

exports.createMemberAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = request.auth.uid;
  const db = getFirestore();
  const auth = getAuth();

  const adminDoc = await db.collection('admins').doc(callerUid).get();
  if (!adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Only administrators can create member accounts.');
  }

  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    address,
    password,
    donationAmount,
    totalAsset,
    kycStatus,
  } = request.data || {};

  if (!firstName || !lastName || !email || !phoneNumber || !address || !password) {
    throw new HttpsError('invalid-argument', 'Missing required fields.');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const safeKycStatus = ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED'].includes(kycStatus)
    ? kycStatus
    : 'NOT_SUBMITTED';

  try {
    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    if (!userRecord) {
      userRecord = await auth.createUser({
        email: normalizedEmail,
        password: String(password),
        displayName: `${firstName} ${lastName}`.trim(),
      });
    }

    const uid = userRecord.uid;
    const memberRef = db.collection('members').doc(uid);
    const existingMember = await memberRef.get();

    const payload = {
      uid,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      name: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
      email: normalizedEmail,
      phoneNumber: String(phoneNumber).trim(),
      address: String(address).trim(),
      donationAmount: Number(donationAmount) || 0,
      totalAsset: Number(totalAsset) || 0,
      kycStatus: safeKycStatus,
      role: 'member',
      status: 'active',
      hasPinSetup: false,
      updatedAt: nowIso,
      ...(safeKycStatus === 'APPROVED' || safeKycStatus === 'REJECTED'
        ? {kycProcessedAt: nowIso}
        : {}),
      ...(safeKycStatus === 'PENDING' ? {kycSubmittedAt: nowIso} : {}),
      ...(existingMember.exists ? {} : {createdAt: nowIso}),
    };

    await memberRef.set(payload, {merge: true});

    return {
      success: true,
      uid,
      email: normalizedEmail,
      created: !existingMember.exists,
      message: !existingMember.exists
        ? 'Member account created in Auth and Firestore.'
        : 'Existing Auth user linked/updated in Firestore members.',
    };
  } catch (error) {
    throw new HttpsError('internal', error?.message || 'Failed to create member account.');
  }
});
