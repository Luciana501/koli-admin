import React from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/withdrawals": "ODHex Withdrawals",
  "/donations": "Donations",
  "/kyc": "KYC",
  "/reports": "Reports",
  "/mana-reward": "MANA Reward",
  "/reward-history": "Reward History",
  "/presale-admin": "Presale Admin",
  "/chat": "Chat",
  "/chat/conversation": "Conversation",
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] || "";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
          <SidebarTrigger className="shrink-0" />
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {pageTitle}
          </h1>
        </header>
        <main className="flex-1 min-w-0 w-full overflow-x-hidden overflow-y-auto bg-background">
          <div className="w-full max-w-full p-2 sm:p-4 md:p-6 lg:p-8 overflow-x-hidden">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
