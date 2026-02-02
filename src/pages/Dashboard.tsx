import React from "react";
import { useAuth } from "@/context/AuthContext";
import { mockUsers, mockWithdrawals } from "@/data/mockData";
import { IconUsers, IconCash, IconArrowUpRight, IconWallet } from "@tabler/icons-react";

const Dashboard = () => {
  const { adminType } = useAuth();

  const stats = [
    {
      title: "Total Users",
      value: mockUsers.length.toString(),
      icon: IconUsers,
      change: "+12%",
    },
    {
      title: "Total Deposits",
      value: `$${mockUsers.reduce((acc, u) => acc + u.depositAmount, 0).toLocaleString()}`,
      icon: IconWallet,
      change: "+8%",
    },
    {
      title: "Total Assets",
      value: `$${mockUsers.reduce((acc, u) => acc + u.totalAsset, 0).toLocaleString()}`,
      icon: IconCash,
      change: "+15%",
    },
    {
      title: "Pending Withdrawals",
      value: mockWithdrawals.filter((w) => w.status === "pending").length.toString(),
      icon: IconArrowUpRight,
      change: `$${mockWithdrawals.reduce((acc, w) => acc + w.amount, 0).toLocaleString()}`,
    },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {adminType === "main" ? "Main" : "Finance"} Admin
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-lg p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm font-medium">
                {stat.title}
              </span>
              <stat.icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Users</h2>
          <div className="space-y-3">
            {mockUsers.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <span className="text-sm font-medium">
                  ${user.totalAsset.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Pending Withdrawals</h2>
          <div className="space-y-3">
            {mockWithdrawals
              .filter((w) => w.status === "pending")
              .slice(0, 5)
              .map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium">{withdrawal.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      {withdrawal.requestedAt}
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    ${withdrawal.amount.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
