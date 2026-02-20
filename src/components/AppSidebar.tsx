import React, { useEffect, useRef, useState } from "react";
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
  IconKey,
  IconVersions,
} from "@tabler/icons-react";
import { subscribeToChatMessages } from "@/services/chat";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type SidebarLink = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

export function AppSidebar() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingOdhexCount, setPendingOdhexCount] = useState(0);
  const [pendingDonationCount, setPendingDonationCount] = useState(0);
  const [pendingKycCount, setPendingKycCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, adminType } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const { toast } = useToast();
  const initializedRef = useRef({ odhex: false, donation: false, kyc: false });
  const previousCountsRef = useRef({ odhex: 0, donation: 0, kyc: 0 });

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

  useEffect(() => {
    const odhexQuery = query(collection(db, "odhexWithdrawals"), where("status", "==", "pending"));
    const donationQuery = query(collection(db, "donationContracts"), where("status", "==", "pending"));
    const kycQuery = query(collection(db, "members"), where("kycStatus", "==", "PENDING"));

    const unsubscribeOdhex = onSnapshot(odhexQuery, (snapshot) => {
      const currentCount = snapshot.size;
      setPendingOdhexCount(currentCount);

      if (initializedRef.current.odhex && currentCount > previousCountsRef.current.odhex) {
        const added = currentCount - previousCountsRef.current.odhex;
        toast({
          title: "New Withdrawal Request",
          description: `${added} new ODHex withdrawal ${added > 1 ? "requests" : "request"} pending.`,
        });
      }

      initializedRef.current.odhex = true;
      previousCountsRef.current.odhex = currentCount;
    });

    const unsubscribeDonations = onSnapshot(donationQuery, (snapshot) => {
      const currentCount = snapshot.size;
      setPendingDonationCount(currentCount);

      if (initializedRef.current.donation && currentCount > previousCountsRef.current.donation) {
        const added = currentCount - previousCountsRef.current.donation;
        toast({
          title: "New Donation Submission",
          description: `${added} new donation ${added > 1 ? "submissions" : "submission"} pending review.`,
        });
      }

      initializedRef.current.donation = true;
      previousCountsRef.current.donation = currentCount;
    });

    const unsubscribeKyc = onSnapshot(kycQuery, (snapshot) => {
      const currentCount = snapshot.size;
      setPendingKycCount(currentCount);

      if (initializedRef.current.kyc && currentCount > previousCountsRef.current.kyc) {
        const added = currentCount - previousCountsRef.current.kyc;
        toast({
          title: "New KYC Submission",
          description: `${added} new KYC ${added > 1 ? "applications" : "application"} waiting for validation.`,
        });
      }

      initializedRef.current.kyc = true;
      previousCountsRef.current.kyc = currentCount;
    });

    return () => {
      unsubscribeOdhex();
      unsubscribeDonations();
      unsubscribeKyc();
    };
  }, [toast]);

  const formatBadge = (count: number) => {
    if (count <= 0) return undefined;
    return count > 9 ? "9+" : String(count);
  };

  const mainLinks: SidebarLink[] = [
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
      label: "ODHex Withdrawals",
      href: "/withdrawals",
      icon: IconCash,
      badge: formatBadge(pendingOdhexCount),
    },
  ];

  const adminLinks: SidebarLink[] = [
    ...(adminType === "developer"
      ? [
          { label: "KYC", href: "/kyc", icon: IconShieldCheck, badge: formatBadge(pendingKycCount) },
          { label: "MANA Reward", href: "/mana-reward", icon: IconStar },
          { label: "Platform Codes", href: "/platform-codes", icon: IconKey },
          { label: "Donations", href: "/donations", icon: IconHeart, badge: formatBadge(pendingDonationCount) },
          { label: "Reward History", href: "/reward-history", icon: IconTrophy },
          { label: "News", href: "/news", icon: IconChartLine },
          { label: "App Version", href: "/app-version", icon: IconVersions },
        ]
      : []),
    ...(adminType === "finance"
      ? [
          { label: "KYC Verification", href: "/kyc", icon: IconShieldCheck, badge: formatBadge(pendingKycCount) },
          { label: "Donations", href: "/donations", icon: IconHeart, badge: formatBadge(pendingDonationCount) },
        ]
      : []),
  ];

  const otherLinks: SidebarLink[] = [
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
                  {adminType === "developer" ? "D" : "F"}
                </span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {adminType === "developer" ? "Developer Admin" : "Finance Admin"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {adminType === "developer" ? "Full Access" : "Finance Access"}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
