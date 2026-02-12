const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const db = admin.firestore();

exports.handleODHexWithdrawalRejectionRefund = onDocumentUpdated(
  'odhexWithdrawals/{withdrawalId}',
  async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    if (!beforeData || !afterData) {
      return;
    }

    const beforeStatus = (beforeData.status || '').toLowerCase();
    const afterStatus = (afterData.status || '').toLowerCase();

    const isRejectionTransition = beforeStatus !== 'rejected' && afterStatus === 'rejected';
    if (!isRejectionTransition) {
      return;
    }

    if (afterData.refundApplied === true) {
      return;
    }

    const userId = afterData.userId;
    const amount = Number(afterData.amount || 0);

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      console.warn('Skipping refund due to invalid userId/amount', {
        withdrawalId: event.params.withdrawalId,
        userId,
        amount: afterData.amount,
      });
      return;
    }

    const withdrawalRef = event.data.after.ref;

    let memberRef = db.collection('ODHexMembers').doc(userId);
    let memberSnap = await memberRef.get();

    if (!memberSnap.exists) {
      const memberQuery = await db
        .collection('ODHexMembers')
        .where('uid', '==', userId)
        .limit(1)
        .get();

      if (memberQuery.empty) {
        console.error('ODHex member not found for withdrawal refund', {
          withdrawalId: event.params.withdrawalId,
          userId,
        });
        await withdrawalRef.update({
          refundApplied: false,
          refundError: 'member_not_found',
          refundErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      memberRef = memberQuery.docs[0].ref;
      memberSnap = memberQuery.docs[0];
    }

    const rejectionNote =
      afterData.rejectionReason ||
      afterData.financeNote ||
      'Withdrawal rejected by finance admin.';

    await db.runTransaction(async (transaction) => {
      const latestWithdrawalSnap = await transaction.get(withdrawalRef);
      const latestWithdrawal = latestWithdrawalSnap.data() || {};

      if (
        (latestWithdrawal.status || '').toLowerCase() !== 'rejected' ||
        latestWithdrawal.refundApplied === true
      ) {
        return;
      }

      const latestMemberSnap = await transaction.get(memberRef);
      if (!latestMemberSnap.exists) {
        throw new Error('ODHex member document disappeared during transaction');
      }

      const latestMember = latestMemberSnap.data() || {};
      const balanceBefore = Number(latestMember.vaultBalance || 0);
      const balanceAfter = balanceBefore + amount;

      const ledgerRef = memberRef.collection('odhexLedger').doc();

      transaction.update(memberRef, {
        vaultBalance: balanceAfter,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.set(ledgerRef, {
        type: 'withdrawal_rejected_refund',
        direction: 'credit',
        amount,
        balanceBefore,
        balanceAfter,
        note: rejectionNote,
        status: 'completed',
        withdrawalId: event.params.withdrawalId,
        userId,
        requestedAt: latestWithdrawal.requestedAt || null,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: 'admin_rejection',
      });

      transaction.update(withdrawalRef, {
        refundApplied: true,
        refundAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundLedgerPath: ledgerRef.path,
        refundTargetMemberId: memberRef.id,
        rejectionReason: rejectionNote,
      });
    });
  }
);
