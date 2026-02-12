import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCBZLgXkQCJAi9kHlQQ-XLnKXx8wEP0Rjo",
  authDomain: "koli-2bad9.firebaseapp.com",
  projectId: "koli-2bad9",
  storageBucket: "koli-2bad9.firebasestorage.app",
  messagingSenderId: "231983013520",
  appId: "1:231983013520:web:04d8b3f18db50c6dbbc215",
  measurementId: "G-29G72J7WW9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistence and cache settings
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  // Fallback to default Firestore if initialization fails
  console.warn("Failed to initialize Firestore with cache settings, using default:", error);
  db = getFirestore(app);
}

// Initialize Firebase services
export const auth = getAuth(app);
export { db };
export const storage = getStorage(app);
// Initialize functions with the correct region (us-central1 is default)
export const functions = getFunctions(app, 'us-central1');
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export default app;
