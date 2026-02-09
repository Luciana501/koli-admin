const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

// Import the expireRewards function
const { expireRewardCodes, expireRewardCodesHttp } = require('./expireRewards');

// Export the functions
exports.expireRewardCodes = expireRewardCodes;
exports.expireRewardCodesHttp = expireRewardCodesHttp;
