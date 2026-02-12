const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');

// Initialize admin (only once, checked in index.js)
// const admin = initializeApp();

/**
 * HTTP callable function to delete a user from both Authentication and Firestore
 * This requires authentication and should only be called by admin users
 */
exports.deleteUserAccount = onCall(async (request) => {
  // Log the entire context for debugging
  console.log('Request auth:', request.auth);
  
  // Check if user is authenticated
  if (!request.auth) {
    console.error('Authentication failed. No auth in request');
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated to delete accounts.'
    );
  }

  // Verify the caller is an admin
  const callerUid = request.auth.uid;
  console.log('Authenticated user UID:', callerUid);
  
  try {
    const db = getFirestore();
    const adminDoc = await db.collection('admins').doc(callerUid).get();
    console.log('Admin doc exists:', adminDoc.exists);
    
    if (!adminDoc.exists) {
      throw new HttpsError(
        'permission-denied',
        'Only administrators can delete user accounts.'
      );
    }
    
    console.log('Admin verified, admin type:', adminDoc.data().type);
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    console.error('Error verifying admin status:', error);
    throw new HttpsError(
      'internal',
      'Failed to verify admin privileges.'
    );
  }

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError(
      'invalid-argument',
      'User ID is required.'
    );
  }

  console.log('Attempting to delete user:', userId);

  try {
    const auth = getAuth();
    const db = getFirestore();
    
    // Delete from Firebase Authentication
    try {
      await auth.deleteUser(userId);
      console.log(`Successfully deleted user from Authentication: ${userId}`);
    } catch (authError) {
      if (authError.code === 'auth/user-not-found') {
        console.log(`User not found in Authentication: ${userId}, continuing with Firestore deletion`);
      } else {
        console.error('Auth deletion error:', authError);
        throw authError;
      }
    }

    // Delete from Firestore
    await db.collection('members').doc(userId).delete();
    console.log(`Successfully deleted user from Firestore: ${userId}`);

    return {
      success: true,
      message: `User ${userId} deleted successfully from both Authentication and Firestore.`
    };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new HttpsError(
      'internal',
      `Failed to delete user: ${error.message}`
    );
  }
});
