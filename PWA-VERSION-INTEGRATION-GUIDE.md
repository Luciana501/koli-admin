# PWA Version Manager - Integration Guide for KOLI System

## ✅ Admin Panel Setup (COMPLETED)

The admin panel is now fully configured with:
- **App Version Manager** page at `/app-version` (Developer admin only)
- Firestore service functions for reading/writing version config
- TypeScript types for version configuration

---

## 🔧 What You Need to Integrate in Your PWA

### 1. **Initialize Firestore Document** (One-Time Setup)

First, you need to create the initial version config document in Firestore.

**Option A: Using Firebase Console**
1. Go to Firebase Console → Firestore Database
2. Create a new collection: `appVersion`
3. Create a document with ID: `config`
4. Add these fields:
   ```
   deployedVersion: "1.0.0"
   minimumVersion: "1.0.0"
   forceRefresh: false
   updateMessage: "A new version of KOLI is available. Click to refresh."
   lastUpdated: [current timestamp]
   ```

**Option B: Using Admin Panel**
1. Login to admin panel as developer
2. Navigate to `/app-version`
3. The page will auto-initialize the document on first load

---

### 2. **Add Version Check to Your PWA** (Required Code)

Add this code to your PWA's main entry point (usually `App.tsx` or `index.tsx`):

#### **A. Install compare-versions library**
```bash
npm install compare-versions
# or
yarn add compare-versions
```

#### **B. Create version check service**

Create file: `src/services/versionCheck.ts`

```typescript
import { compare } from 'compare-versions';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Your app's current version (from package.json or hardcoded)
const CURRENT_APP_VERSION = "1.0.0"; // Update this when you deploy new versions

interface AppVersionConfig {
  deployedVersion: string;
  minimumVersion: string;
  forceRefresh: boolean;
  updateMessage: string;
}

/**
 * Check if app needs to update
 * Returns: { needsUpdate, forceUpdate, message }
 */
export const checkAppVersion = async () => {
  try {
    const db = getFirestore();
    const configRef = doc(db, 'appVersion', 'config');
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      console.warn('App version config not found');
      return { needsUpdate: false, forceUpdate: false, message: '' };
    }

    const config = configSnap.data() as AppVersionConfig;
    
    // Get cached version from localStorage
    const cachedVersion = localStorage.getItem('app_version') || '0.0.0';
    
    // Compare versions
    const isOutdated = compare(CURRENT_APP_VERSION, config.deployedVersion, '<');
    const isBelowMinimum = compare(CURRENT_APP_VERSION, config.minimumVersion, '<');
    
    return {
      needsUpdate: isOutdated,
      forceUpdate: isBelowMinimum || config.forceRefresh,
      message: config.updateMessage,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: config.deployedVersion,
    };
  } catch (error) {
    console.error('Error checking app version:', error);
    return { needsUpdate: false, forceUpdate: false, message: '' };
  }
};

/**
 * Update cached version in localStorage
 */
export const updateCachedVersion = (version: string) => {
  localStorage.setItem('app_version', version);
};

/**
 * Force reload the app (clears service worker cache)
 */
export const forceAppReload = async () => {
  // Unregister service worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
  }
  
  // Clear cache storage
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
  
  // Hard reload
  window.location.reload();
};
```

#### **C. Create Update Banner Component**

Create file: `src/components/UpdateBanner.tsx`

```typescript
import React from 'react';
import { forceAppReload } from '@/services/versionCheck';

interface UpdateBannerProps {
  message: string;
  forceUpdate: boolean;
  onDismiss?: () => void;
}

const UpdateBanner: React.FC<UpdateBannerProps> = ({ 
  message, 
  forceUpdate, 
  onDismiss 
}) => {
  const handleUpdate = async () => {
    await forceAppReload();
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 shadow-lg">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex-1">
          <p className="font-medium">{message}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            Update Now
          </button>
          {!forceUpdate && onDismiss && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-800 transition"
            >
              Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
```

#### **D. Integrate Version Check in App**

In your `App.tsx` or main component:

```typescript
import React, { useEffect, useState } from 'react';
import { checkAppVersion, updateCachedVersion } from '@/services/versionCheck';
import UpdateBanner from '@/components/UpdateBanner';

function App() {
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [updateConfig, setUpdateConfig] = useState({
    message: '',
    forceUpdate: false,
  });

  useEffect(() => {
    // Check version on app load
    const checkVersion = async () => {
      const versionStatus = await checkAppVersion();

      if (versionStatus.needsUpdate) {
        setUpdateConfig({
          message: versionStatus.message,
          forceUpdate: versionStatus.forceUpdate,
        });
        setShowUpdateBanner(true);
      } else {
        // Update cached version if up to date
        if (versionStatus.currentVersion) {
          updateCachedVersion(versionStatus.currentVersion);
        }
      }
    };

    checkVersion();
  }, []);

  return (
    <>
      {showUpdateBanner && (
        <UpdateBanner
          message={updateConfig.message}
          forceUpdate={updateConfig.forceUpdate}
          onDismiss={
            updateConfig.forceUpdate 
              ? undefined 
              : () => setShowUpdateBanner(false)
          }
        />
      )}
      
      {/* Your app content */}
      <div className={showUpdateBanner ? 'mt-16' : ''}>
        {/* ... rest of your app ... */}
      </div>
    </>
  );
}

export default App;
```

---

### 3. **Update Your Service Worker** (If Using One)

In your `service-worker.js` or `sw.js`:

```javascript
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Listen for version updates
self.addEventListener('install', (event) => {
  // Force the new service worker to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(clients.claim());
});
```

---

### 4. **Update package.json Version**

Every time you deploy a new version, update the version in your `package.json`:

```json
{
  "name": "koli-pwa",
  "version": "1.0.1",  // ← Update this
  // ...
}
```

And in your code, reference it:

```typescript
import packageJson from '../package.json';
const CURRENT_APP_VERSION = packageJson.version;
```

Or hardcode it in your version check service.

---

## 📋 Deployment Workflow

### When You Deploy a New Version:

1. **Update your PWA code** (fix bugs, add features)
2. **Increment version** in `package.json` (e.g., `1.0.0` → `1.0.1`)
3. **Build and deploy** your PWA
4. **Update admin panel**:
   - Go to `/app-version`
   - Set `Deployed Version` to `1.0.1`
   - Set `Minimum Version` to `1.0.0` (or higher if breaking changes)
   - Enable `Force Refresh` if critical update
   - Click "Save Changes"

5. **Users see update prompt** on next page load:
   - If `Force Refresh` is ON: Non-dismissible modal → must update
   - If `Force Refresh` is OFF: Dismissible banner → can update later

---

## 🎯 Real-World Scenarios

### Scenario 1: Critical Security Fix
```
Deployed Version: 1.0.5
Minimum Version: 1.0.5
Force Refresh: ON ✅
Message: "Critical security update required. Please update now."
```
→ All users **must** update immediately

### Scenario 2: Minor Feature Release
```
Deployed Version: 1.1.0
Minimum Version: 1.0.0
Force Refresh: OFF
Message: "New features available! Update to get the latest."
```
→ Users **can skip** and update later

### Scenario 3: Broken Version Block
```
Deployed Version: 1.0.8
Minimum Version: 1.0.7  ← blocks v1.0.6 and below
Force Refresh: ON ✅
Message: "Your version has known issues. Update required."
```
→ Users on v1.0.6 or below **must** update

---

## 🔍 Testing

### Test Force Update:
1. Set admin panel: `minimumVersion = "2.0.0"`, `deployedVersion = "2.0.0"`
2. Open your PWA (currently on v1.0.0)
3. Should see non-dismissible update banner

### Test Soft Update:
1. Set admin panel: `minimumVersion = "1.0.0"`, `deployedVersion = "1.1.0"`, `forceRefresh = false`
2. Open your PWA (currently on v1.0.0)
3. Should see dismissible update banner

---

## 📱 Firebase Security Rules

Add this to your `firestore.rules`:

```javascript
match /appVersion/{document=**} {
  // Public read access for all users
  allow read: if true;
  
  // Only admins can write
  allow write: if request.auth != null && 
    exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
```

---

## ✅ Summary Checklist

- [x] Admin panel configured with App Version Manager
- [ ] Add `compare-versions` package to PWA
- [ ] Create `versionCheck.ts` service
- [ ] Create `UpdateBanner.tsx` component
- [ ] Integrate version check in `App.tsx`
- [ ] Update service worker (if applicable)
- [ ] Initialize Firestore document
- [ ] Update Firebase security rules
- [ ] Test force update scenario
- [ ] Test soft update scenario

---

## 🚀 You're Done!

Once integrated, you can control your PWA updates directly from the admin panel at `/app-version` without redeploying!

**Questions?** All the admin panel code is already working. Just follow the PWA integration steps above.
