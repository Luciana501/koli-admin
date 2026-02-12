import React from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/users": "Users",
  "/withdrawals": "Withdrawals",
  "/donations": "Donations",
  "/kyc": "KYC",
  "/reports": "Reports",
  "/mana-reward": "MANA Reward",
  "/reward-history": "Reward History",
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
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="truncate text-sm font-semibold sm:text-base">
            {pageTitle}
          </h1>
        </header>
        <main className="flex-1 w-full overflow-y-auto bg-background">
          <div className="p-3 sm:p-6 lg:p-8 max-w-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
