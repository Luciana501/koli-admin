const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

// Import the expireRewards function
const { expireRewardCodes, expireRewardCodesHttp } = require('./expireRewards');

// Import the deleteUser function
const { deleteUserAccount } = require('./deleteUser');
const { handleODHexWithdrawalRejectionRefund } = require('./odhexRefunds');

// Export the functions
exports.expireRewardCodes = expireRewardCodes;
exports.expireRewardCodesHttp = expireRewardCodesHttp;
exports.deleteUserAccount = deleteUserAccount;
exports.handleODHexWithdrawalRejectionRefund = handleODHexWithdrawalRejectionRefund;
