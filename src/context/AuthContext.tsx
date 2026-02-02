import React, { createContext, useContext, useState, ReactNode } from "react";
import { AdminType } from "@/types/admin";

interface AuthContextType {
  isAuthenticated: boolean;
  adminType: AdminType | null;
  login: (email: string, password: string, type: AdminType) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminType, setAdminType] = useState<AdminType | null>(null);

  const login = (email: string, password: string, type: AdminType) => {
    // Mock authentication - in production, this would call an API
    if (email && password) {
      setIsAuthenticated(true);
      setAdminType(type);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAdminType(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, adminType, login, logout }}>
      {children}
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
