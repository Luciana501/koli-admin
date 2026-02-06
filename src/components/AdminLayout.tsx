import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarBody,
  SidebarLink,
} from "@/components/ui/aceternity-sidebar";
import {
  IconLayoutDashboard,
  IconUsers,
  IconCash,
  IconLogout,
  IconMenu2,
  IconChartLine,
  IconMessage,
  IconHeart,
  IconShieldCheck,
  IconStar,
  IconTrophy,
} from "@tabler/icons-react";
import { motion } from "motion/react";
import { subscribeToChatMessages } from "@/services/chat";
import { auth } from "@/lib/firebase";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, adminType } = useAuth();

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setOpen(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [location.pathname]);

  useEffect(() => {
    // Subscribe to chat messages to count unread
    const unsubscribe = subscribeToChatMessages((messages) => {
      const currentUserId = auth.currentUser?.uid;
      const unread = messages.filter(
        (msg) => !msg.read && msg.senderId !== currentUserId
      ).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  const links = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: <IconLayoutDashboard className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Users",
      href: "/users",
      icon: <IconUsers className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Withdrawals",
      href: "/withdrawals",
      icon: <IconCash className="h-5 w-5 shrink-0" />,
    },
    // Add KYC link for main admin
    ...(adminType === "main"
      ? [
          {
            label: "KYC",
            href: "/kyc",
            icon: <IconShieldCheck className="h-5 w-5 shrink-0" />,
          },
          {
            label: "MANA Reward",
            href: "/mana-reward",
            icon: <IconStar className="h-5 w-5 shrink-0" />,
          },
          {
            label: "Donations",
            href: "/donations",
            icon: <IconHeart className="h-5 w-5 shrink-0" />,
          },
          {
            label: "Reward History",
            href: "/reward-history",
            icon: <IconTrophy className="h-5 w-5 shrink-0" />,
          },
        ]
      : []),
    ...(adminType === "finance"
      ? [
          {
            label: "KYC Verification",
            href: "/kyc",
            icon: <IconShieldCheck className="h-5 w-5 shrink-0" />,
          },
        ]
      : []),
    {
      label: "Reports",
      href: "/reports",
      icon: <IconChartLine className="h-5 w-5 shrink-0" />,
    },
    {
      label: "Chat",
      href: "/chat",
      icon: (
        <div className="relative">
          <IconMessage className="h-5 w-5 shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>
      ),
    },
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleNavigation = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
    setOpen(false); // Close sidebar on mobile after navigation
  };

  return (
    <div className="relative flex h-screen w-full bg-background">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Burger menu button - responsive positioning */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed top-4 z-[60] p-3 rounded-lg bg-card hover:bg-accent border border-border transition-all duration-300 ease-in-out shadow-md ${
          open ? 'left-4 md:left-[220px]' : 'left-4'
        }`}
        style={{ backgroundColor: 'hsl(var(--card))', backdropFilter: 'blur(8px)' }}
      >
        <IconMenu2 className="h-5 w-5 text-foreground" />
      </button>
      
      {/* Sidebar - hidden on mobile by default, overlay when open */}
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className={`flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed md:relative z-50 md:z-auto ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } transition-transform duration-300 ease-in-out`}>
          <div className="flex flex-col overflow-x-hidden overflow-y-auto flex-1">
            {open ? (
              <div className="flex items-center px-3 pt-4 mb-4" style={{ backgroundColor: 'transparent', height: '56px' }}>
                <Logo />
              </div>
            ) : (
              <div style={{ height: '56px' }}></div>
            )}
            <div className="flex flex-col gap-1">
              {links.map((link, idx) => (
                <SidebarLink
                  key={idx}
                  link={link}
                  isActive={location.pathname === link.href}
                  onClick={(e: React.MouseEvent) => handleNavigation(link.href, e)}
                />
              ))}
            </div>
          </div>
          <div className="mt-auto mb-0">
            <SidebarLink
              link={{
                label: "Logout",
                href: "#",
                icon: <IconLogout className="h-5 w-5 shrink-0" />,
              }}
              onClick={handleLogout}
            />
            <div className="px-2 py-3 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="text-primary-foreground text-sm font-medium">
                    {adminType === "main" ? "M" : "F"}
                  </span>
                </div>
                {open && (
                  <span className="text-sm font-medium">
                    {adminType === "main" ? "Main Admin" : "Finance Admin"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      
      {/* Main content - responsive padding */}
      <main className="flex-1 h-full overflow-y-auto bg-background w-full md:w-auto" style={{ overscrollBehavior: 'none' }}>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

const Logo = () => {
  return (
    <a
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal"
      style={{ backgroundColor: 'transparent' }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-xl whitespace-pre text-foreground"
        style={{ backgroundColor: 'transparent' }}
      >
        KOLI
      </motion.span>
    </a>
  );
};

const LogoIcon = () => {
  return (
    <div className="flex items-center justify-center py-1" style={{ backgroundColor: 'transparent' }}>
      <span className="font-bold text-xl text-foreground">K</span>
    </div>
  );
};

export default AdminLayout;
