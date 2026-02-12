import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  IconLayoutDashboard,
  IconUsers,
  IconCash,
  IconLogout,
  IconChartLine,
  IconMessage,
  IconHeart,
  IconShieldCheck,
  IconStar,
  IconTrophy,
} from "@tabler/icons-react";
import { subscribeToChatMessages } from "@/services/chat";
import { auth } from "@/lib/firebase";

export function AppSidebar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, adminType } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    const unsubscribe = subscribeToChatMessages((messages) => {
      const currentUserId = auth.currentUser?.uid;
      const unread = messages.filter(
        (msg) => !msg.read && msg.senderId !== currentUserId
      ).length;
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, []);

  const mainLinks = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: IconLayoutDashboard,
    },
    {
      label: "Users",
      href: "/users",
      icon: IconUsers,
    },
    {
      label: "Withdrawals",
      href: "/withdrawals",
      icon: IconCash,
    },
  ];

  const adminLinks = [
    ...(adminType === "main"
      ? [
          { label: "KYC", href: "/kyc", icon: IconShieldCheck },
          { label: "MANA Reward", href: "/mana-reward", icon: IconStar },
          { label: "Donations", href: "/donations", icon: IconHeart },
          { label: "Reward History", href: "/reward-history", icon: IconTrophy },
        ]
      : []),
    ...(adminType === "finance"
      ? [{ label: "KYC Verification", href: "/kyc", icon: IconShieldCheck }]
      : []),
  ];

  const otherLinks = [
    {
      label: "Reports",
      href: "/reports",
      icon: IconChartLine,
    },
    {
      label: "Chat",
      href: "/chat",
      icon: IconMessage,
      badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : String(unreadCount)) : undefined,
    },
  ];

  const handleNavigation = (href: string) => {
    navigate(href);
    // Close the mobile sidebar sheet after navigation
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleLogout = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    logout();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="text-sm font-bold">K</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold text-lg">KOLI</span>
                <span className="truncate text-xs text-muted-foreground">Admin Panel</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainLinks.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === link.href}
                    tooltip={link.label}
                  >
                    <a
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(link.href);
                      }}
                    >
                      <link.icon className="size-4" />
                      <span>{link.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin-specific links */}
        {adminLinks.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminLinks.map((link) => (
                  <SidebarMenuItem key={link.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === link.href}
                      tooltip={link.label}
                    >
                      <a
                        href={link.href}
                        onClick={(e) => {
                          e.preventDefault();
                          handleNavigation(link.href);
                        }}
                      >
                        <link.icon className="size-4" />
                        <span>{link.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Other links */}
        <SidebarGroup>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {otherLinks.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === link.href}
                    tooltip={link.label}
                  >
                    <a
                      href={link.href}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigation(link.href);
                      }}
                    >
                      <link.icon className="size-4" />
                      <span>{link.label}</span>
                    </a>
                  </SidebarMenuButton>
                  {link.badge && (
                    <SidebarMenuBadge className="bg-destructive text-destructive-foreground rounded-full text-[10px] font-bold">
                      {link.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Logout"
              onClick={handleLogout}
            >
              <IconLogout className="size-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="cursor-default hover:bg-transparent active:bg-transparent">
              <div className="flex aspect-square size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="text-sm font-medium">
                  {adminType === "main" ? "M" : "F"}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {adminType === "main" ? "Main Admin" : "Finance Admin"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {adminType === "main" ? "Full Access" : "Finance Access"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
