# Automatic Reward Code Expiration

This Cloud Function automatically expires reward codes when their expiration date passes.

## Setup Instructions

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Deploy the Function

```bash
firebase deploy --only functions:expireRewardCodes
```

### 3. (Optional) Deploy HTTP Trigger Version

If you want to manually trigger expiration or use a custom scheduler:

```bash
firebase deploy --only functions:expireRewardCodesHttp
```

Then set the secret key:
```bash
firebase functions:config:set expire.secret="your-secret-key-here"
firebase deploy --only functions
```

### 4. Deploy Updated Firestore Rules

```bash
firebase deploy --only firestore:rules
```

## How It Works

### Scheduled Function (Recommended)
- Runs automatically every 1 hour
- Checks all rewards with status "active"
- Updates status to "expired" if expiresAt has passed
- Adds an "expiredAt" timestamp field

### HTTP Trigger Function (Optional)
- Can be called manually via HTTP request
- Requires secret key in header or query parameter
- Useful for testing or custom scheduling

Example usage:
```bash
curl -X POST "https://YOUR-PROJECT.cloudfunctions.net/expireRewardCodesHttp?key=your-secret-key-here"
```

## Testing

You can test the function locally:

```bash
# Start Firebase emulators
firebase emulators:start

# In another terminal, trigger the HTTP function
curl -X POST "http://localhost:5001/YOUR-PROJECT/us-central1/expireRewardCodesHttp?key=your-secret-key-here"
```

## Monitoring

View function logs:
```bash
firebase functions:log
```

Or in Firebase Console:
- Go to Functions section
- Click on the function name
- View the Logs tab

## Important Notes

1. **Time Zone**: The function runs in Asia/Manila timezone (UTC+8)
2. **Schedule**: Runs every hour - you can adjust this in the code
3. **Batch Updates**: Uses Firestore batch writes for efficiency
4. **Server Timestamp**: Adds `expiredAt` field when expiring codes

## Troubleshooting

If codes aren't expiring:
1. Check function logs for errors
2. Verify the function is deployed: `firebase functions:list`
3. Check expiresAt format in Firestore (should be ISO string)
4. Ensure the function has permission to write to Firestore

## Alternative: Client-Side Expiration

The UI already handles displaying expired status without database updates. The RewardHistory.tsx code automatically shows "expired" for codes past their expiration date:

```tsx
const isExpired = r.expiresAt && new Date(r.expiresAt).getTime() < now;
const status = isExpired ? 'expired' : r.status;
```

This Cloud Function ensures the database is also updated for consistency.
