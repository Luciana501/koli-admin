import React, { useState } from "react";
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
} from "@tabler/icons-react";
import { motion } from "motion/react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, adminType } = useAuth();

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
  ];

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleNavigation = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-sidebar border-r border-sidebar-border">
          <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
            {open ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-1">
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
          <div>
            <SidebarLink
              link={{
                label: "Logout",
                href: "#",
                icon: <IconLogout className="h-5 w-5 shrink-0" />,
              }}
              onClick={handleLogout}
            />
            <div className="mt-4 px-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-medium">
                    {adminType === "main" ? "M" : "F"}
                  </span>
                </div>
                <motion.span
                  animate={{
                    display: open ? "inline-block" : "none",
                    opacity: open ? 1 : 0,
                  }}
                  className="text-sm font-medium"
                >
                  {adminType === "main" ? "Main Admin" : "Finance Admin"}
                </motion.span>
              </div>
            </div>
          </div>
        </SidebarBody>
      </Sidebar>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
};

const Logo = () => {
  return (
    <a
      href="#"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal"
    >
      <div className="h-6 w-8 shrink-0 rounded-sm bg-primary" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-bold text-xl whitespace-pre text-foreground"
      >
        KOLI
      </motion.span>
    </a>
  );
};

const LogoIcon = () => {
  return (
    <a
      href="#"
      className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal"
    >
      <div className="h-6 w-8 shrink-0 rounded-sm bg-primary" />
    </a>
  );
};

export default AdminLayout;
