import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "./pages/Login";
import AdminLayout from "./components/AdminLayout";
import NotFound from "./pages/NotFound";

// Lazy load all page components for faster initial load
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Users = React.lazy(() => import("./pages/Users"));
const Withdrawals = React.lazy(() => import("./pages/Withdrawals"));
const Donations = React.lazy(() => import("./pages/Donations"));
const KYC = React.lazy(() => import("./pages/KYC"));
const Reports = React.lazy(() => import("./pages/Reports"));
const Chat = React.lazy(() => import("./pages/Chat"));
const ChatList = React.lazy(() => import("./pages/ChatList"));
const ManaRewardPage = React.lazy(() => import("./pages/ManaReward"));
const RewardHistory = React.lazy(() => import("./pages/RewardHistory"));
const PlatformCodes = React.lazy(() => import("./pages/PlatformCodes"));
const NewsCreation = React.lazy(() => import("./pages/NewsCreation"));
const NewsManage = React.lazy(() => import("./pages/NewsManage"));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return (
    <AdminLayout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </AdminLayout>
  );
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/" 
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} 
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/withdrawals"
        element={
          <ProtectedRoute>
            <Withdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/donations"
        element={
          <ProtectedRoute>
            <Donations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/kyc"
        element={
          <ProtectedRoute>
            <KYC />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Reports />
          </ProtectedRoute>
        }
      />
          <Route
            path="/mana-reward"
            element={
              <ProtectedRoute>
                <ManaRewardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reward-history"
            element={
              <ProtectedRoute>
                <RewardHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform-codes"
            element={
              <ProtectedRoute>
                <PlatformCodes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news"
            element={
              <ProtectedRoute>
                <NewsCreation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/news/manage"
            element={
              <ProtectedRoute>
                <NewsManage />
              </ProtectedRoute>
            }
          />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/conversation"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
