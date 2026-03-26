const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

// Import the expireRewards function
const { expireRewardCodes, expireRewardCodesHttp } = require('./expireRewards');

// Import the deleteUser function
const { deleteUserAccount } = require('./deleteUser');
const { handleODHexWithdrawalRejectionRefund } = require('./odhexRefunds');
const { createMemberAccount } = require('./createMemberAccount');
const { syncPlatformCodeUsage } = require('./platformCodeUsageSync');
const { startFiatExchange, completeKashCashout, rejectKashCashout } = require('./kashCashouts');

// Export the functions
exports.expireRewardCodes = expireRewardCodes;
exports.expireRewardCodesHttp = expireRewardCodesHttp;
exports.deleteUserAccount = deleteUserAccount;
exports.handleODHexWithdrawalRejectionRefund = handleODHexWithdrawalRejectionRefund;
exports.createMemberAccount = createMemberAccount;
exports.syncPlatformCodeUsage = syncPlatformCodeUsage;
exports.startFiatExchange = startFiatExchange;
exports.completeKashCashout = completeKashCashout;
exports.rejectKashCashout = rejectKashCashout;
