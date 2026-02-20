import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppVersionConfig } from "@/types/appVersion";

const VERSION_DOC_ID = "config";
const COLLECTION_NAME = "appVersion";

/**
 * Get current app version configuration
 */
export const getAppVersionConfig = async (): Promise<AppVersionConfig | null> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, VERSION_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as AppVersionConfig;
    }
    return null;
  } catch (error) {
    console.error("Error fetching app version config:", error);
    throw error;
  }
};

/**
 * Update app version configuration
 */
export const updateAppVersionConfig = async (
  config: Partial<AppVersionConfig>,
  adminEmail?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, VERSION_DOC_ID);
    const updateData = {
      ...config,
      lastUpdated: new Date().toISOString(),
      ...(adminEmail && { updatedBy: adminEmail }),
    };

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error("Error updating app version config:", error);
    throw error;
  }
};

/**
 * Initialize app version configuration (first time setup)
 */
export const initializeAppVersionConfig = async (
  adminEmail?: string
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, VERSION_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      const initialConfig: AppVersionConfig = {
        deployedVersion: "1.0.0",
        minimumVersion: "1.0.0",
        forceRefresh: false,
        updateMessage: "A new version of KOLI is available. Click to refresh.",
        lastUpdated: new Date().toISOString(),
        ...(adminEmail && { updatedBy: adminEmail }),
      };

      await setDoc(docRef, initialConfig);
      console.log("App version config initialized");
    }
  } catch (error) {
    console.error("Error initializing app version config:", error);
    throw error;
  }
};

/**
 * Public API endpoint response - what PWA clients will receive
 */
export const getPublicVersionInfo = async () => {
  const config = await getAppVersionConfig();
  if (!config) {
    throw new Error("App version config not found");
  }

  return {
    version: config.deployedVersion,
    minimumVersion: config.minimumVersion,
    forceUpdate: config.forceRefresh,
    message: config.updateMessage,
  };
};
