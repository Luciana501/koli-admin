import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AdminType } from "@/types/admin";
import { ThemeProvider } from "@/components/ThemeProvider";
import Login from "./pages/Login";
import AdminLayout from "./components/AdminLayout";
import NotFound from "./pages/NotFound";
import PageLoading from "./components/PageLoading";

// Lazy load all page components for faster initial load
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Users = React.lazy(() => import("./pages/Users"));
const Withdrawals = React.lazy(() => import("./pages/Withdrawals"));
const Donations = React.lazy(() => import("./pages/Donations"));
const KYC = React.lazy(() => import("./pages/KYC"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Chat = React.lazy(() => import("./pages/Chat"));
const ChatList = React.lazy(() => import("./pages/ChatList"));
const Settings = React.lazy(() => import("./pages/Settings"));
const ManaRewardPage = React.lazy(() => import("./pages/ManaReward"));
const RewardHistory = React.lazy(() => import("./pages/RewardHistory"));
const PlatformCodes = React.lazy(() => import("./pages/PlatformCodes"));
const NewsCreation = React.lazy(() => import("./pages/NewsCreation"));
const NewsManage = React.lazy(() => import("./pages/NewsManage"));
const AppVersion = React.lazy(() => import("./pages/AppVersion"));

const queryClient = new QueryClient();

const getDefaultRoute = (adminType: AdminType | null) => {
  return adminType === "kyc" ? "/kyc" : "/dashboard";
};

const ProtectedRoute = ({
  children,
  allow,
}: {
  children: React.ReactNode;
  allow?: AdminType[];
}) => {
  const { isAuthenticated, adminType, loading } = useAuth();
  if (loading) {
    return <PageLoading className="min-h-[70vh]" />;
  }
  if (!isAuthenticated || !adminType) {
    return <Navigate to="/" replace />;
  }
  if (allow && !allow.includes(adminType)) {
    return <Navigate to={getDefaultRoute(adminType)} replace />;
  }
  return (
    <AdminLayout>
      <Suspense fallback={<PageLoading className="min-h-[70vh]" />}>
        {children}
      </Suspense>
    </AdminLayout>
  );
};

const AppRoutes = () => {
  const { isAuthenticated, adminType, loading } = useAuth();
  if (loading) {
    return <PageLoading className="min-h-[70vh]" />;
  }
  
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          isAuthenticated
            ? <Navigate to={getDefaultRoute(adminType)} replace />
            : <Login />
        } 
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/withdrawals"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Withdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donations"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Donations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kyc"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2", "kyc"]}>
            <KYC />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Reports />
          </ProtectedRoute>
        }
      />
          <Route
            path="/mana-reward"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <ManaRewardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reward-history"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <RewardHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform-codes"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <PlatformCodes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <NewsCreation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news/manage"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <NewsManage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-version"
            element={
              <ProtectedRoute allow={["developer", "finance2"]}>
                <AppVersion />
              </ProtectedRoute>
            }
          />
      <Route
        path="/chat"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <ChatList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/conversation"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2"]}>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allow={["developer", "finance", "finance2", "kyc"]}>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
