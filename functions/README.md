# Firebase Cloud Functions

This directory contains Firebase Cloud Functions for the KOLI Admin application.

## Functions

### 1. deleteUserAccount

**Purpose:** Deletes a user from both Firebase Authentication and Firestore database.

**Type:** Callable HTTPS Function

**Parameters:**
- `userId` (string, required): The Firebase UID of the user to delete

**Authentication:** Required - Only authenticated admin users can call this function

**What it does:**
1. Deletes the user from Firebase Authentication
2. Deletes the user document from the `members` collection in Firestore
3. Handles cases where the user may not exist in Authentication but exists in Firestore

**Usage from Frontend:**
```typescript
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
const result = await deleteUserAccount({ userId: 'user-id-here' });
```

**Returns:**
```json
{
  "success": true,
  "message": "User {userId} deleted successfully from both Authentication and Firestore."
}
```

**Error Codes:**
- `unauthenticated`: User is not authenticated
- `invalid-argument`: userId parameter is missing
- `internal`: Failed to delete user (with error details)

---

### 2. expireRewardCodes

**Purpose:** Automatically expires reward codes that have passed their expiration date.

See [README-EXPIRATION.md](./README-EXPIRATION.md) for detailed documentation.

---

## Deployment

### Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged in to Firebase: `firebase login`
3. Correct Firebase project selected: `firebase use koli-2bad9`

### Deploy All Functions
```bash
cd functions
npm install
firebase deploy --only functions
```

### Deploy a Specific Function
```bash
firebase deploy --only functions:deleteUserAccount
firebase deploy --only functions:expireRewardCodes
```

### Test Locally
```bash
cd functions
npm run serve
```

This will start the Firebase Emulators for local testing.

---

## Development

### Adding a New Function

1. Create a new file in the `functions/` directory (e.g., `myNewFunction.js`)
2. Export your function from the file
3. Import and export it in `index.js`:
```javascript
const { myNewFunction } = require('./myNewFunction');
exports.myNewFunction = myNewFunction;
```
4. Deploy the function

### Testing

After deployment, you can test the functions:
- View logs: `firebase functions:log`
- View specific function logs: `firebase functions:log --only deleteUserAccount`

---

## Security Notes

### deleteUserAccount Security

- This function requires authentication
- In production, you should add additional checks to verify the caller has admin privileges
- Consider adding custom claims or checking the user's role in Firestore before allowing deletion

**Recommended Enhancement:**
```javascript
// Check if user is admin
const callerRef = admin.firestore().collection('admins').doc(context.auth.uid);
const callerDoc = await callerRef.get();

if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
  throw new functions.https.HttpsError(
    'permission-denied',
    'Only admins can delete users.'
  );
}
```

---

## Troubleshooting

### Function Not Found
- Make sure the function is deployed: `firebase deploy --only functions`
- Check the function name matches in both the backend export and frontend call

### Authentication Errors
- Verify the user is logged in before calling the function
- Check Firebase Rules allow authenticated users to call functions

### CORS Issues
- Callable functions automatically handle CORS
- If using HTTP functions, you may need to configure CORS manually

---

## Monitoring

View function metrics in the Firebase Console:
1. Go to https://console.firebase.google.com
2. Select your project (koli-2bad9)
3. Navigate to Functions section
4. Monitor invocations, errors, and execution time

---

## Cost Considerations

Cloud Functions are billed based on:
- Number of invocations
- Compute time (GB-seconds)
- Network egress

Current functions are lightweight and should stay within free tier limits for moderate usage.

Monitor usage: https://console.firebase.google.com/project/koli-2bad9/usage
