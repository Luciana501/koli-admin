const {onSchedule} = require('firebase-functions/v2/scheduler');
const {onRequest} = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Don't initialize here - it's done in index.js
const db = admin.firestore();

/**
 * Cloud Function that runs every hour to check and expire reward codes
 * Updates status from 'active' to 'expired' when expiresAt has passed
 */
exports.expireRewardCodes = onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'Asia/Manila'
}, async (event) => {
  console.log('Running expireRewardCodes function...');
  
  try {
    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();
    
    // Query all active rewards that have expired
    const expiredRewardsSnapshot = await db.collection('rewardsHistory')
      .where('status', '==', 'active')
      .get();
    
    if (expiredRewardsSnapshot.empty) {
      console.log('No active rewards found');
      return null;
    }
    
    const batch = db.batch();
    let expiredCount = 0;
    
    expiredRewardsSnapshot.forEach((doc) => {
      const data = doc.data();
      const expiresAt = new Date(data.expiresAt);
      
      // Check if the reward has expired
      if (expiresAt < nowDate) {
        console.log(`Expiring reward: ${doc.id} (${data.secretCode}) - Expired at: ${expiresAt.toISOString()}`);
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      await batch.commit();
      console.log(`Successfully expired ${expiredCount} reward code(s)`);
    } else {
      console.log('No rewards to expire at this time');
    }
    
    return { success: true, expiredCount };
  } catch (error) {
    console.error('Error expiring reward codes:', error);
    throw error;
  }
});


/**
 * Alternative: HTTP trigger version that can be called manually or via cron job
 */
exports.expireRewardCodesHttp = onRequest({
  cors: true
}, async (req, res) => {
  // Add security check - only allow with secret key
  const secretKey = req.headers['x-secret-key'] || req.query.key;
  const expectedKey = process.env.EXPIRE_SECRET || 'your-secret-key-here';
  
  if (secretKey !== expectedKey) {
    res.status(403).send('Unauthorized');
    return;
  }
  
  try {
    const now = admin.firestore.Timestamp.now();
    const nowDate = now.toDate();
    
    const expiredRewardsSnapshot = await db.collection('rewardsHistory')
      .where('status', '==', 'active')
      .get();
    
    if (expiredRewardsSnapshot.empty) {
      res.json({ success: true, message: 'No active rewards found', expiredCount: 0 });
      return;
    }
    
    const batch = db.batch();
    let expiredCount = 0;
    
    expiredRewardsSnapshot.forEach((doc) => {
      const data = doc.data();
      const expiresAt = new Date(data.expiresAt);
      
      if (expiresAt < nowDate) {
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp()
        });
        expiredCount++;
      }
    });
    
    if (expiredCount > 0) {
      await batch.commit();
    }
    
    res.json({ 
      success: true, 
      message: `Successfully expired ${expiredCount} reward code(s)`,
      expiredCount 
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

