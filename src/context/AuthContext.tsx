import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AdminType } from "@/types/admin";

interface AuthContextType {
  isAuthenticated: boolean;
  adminType: AdminType | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeAdminType = (type: unknown): AdminType | null => {
  if (type === "developer" || type === "finance") return type;
  if (type === "main") return "developer";
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminType, setAdminType] = useState<AdminType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Fetch admin type from Firestore
          const adminDoc = await getDoc(doc(db, "admins", user.uid));
          if (adminDoc.exists()) {
            setAdminType(normalizeAdminType(adminDoc.data().type));
            setIsAuthenticated(true);
          } else {
            // User exists but not an admin
            setIsAuthenticated(false);
            setAdminType(null);
          }
        } else {
          setIsAuthenticated(false);
          setAdminType(null);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        // If there's a permissions error, keep user logged out
        setIsAuthenticated(false);
        setAdminType(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch admin type from Firestore
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (adminDoc.exists()) {
        setAdminType(normalizeAdminType(adminDoc.data().type));
        setIsAuthenticated(true);
        return true;
      } else {
        await signOut(auth);
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      setAdminType(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, adminType, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
