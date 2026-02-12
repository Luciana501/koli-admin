import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import { subscribeToKYC, updateKYCStatus } from "@/services/firestore";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [kycUsers, setKycUsers] = useState([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();
  const { login, adminType } = useAuth();
  useEffect(() => {
    if (adminType === "developer") {
      const unsubscribe = subscribeToKYC((users) => {
        setKycUsers(users.filter(u => u.kycStatus === "PENDING"));
        setKycLoading(false);
      });
      return () => unsubscribe();
    }
  }, [adminType]);
  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "APPROVED");
      setKycUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert("Failed to approve KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "REJECTED");
      setKycUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert("Failed to reject KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (!email || !password) {
      setError("Please fill in all fields");
      setLoading(false);
      return;
    }
    const success = await login(email, password);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Invalid credentials or not authorized");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 sm:px-6">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">KOLI Portal</h1>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="admin@koli.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          {/* KYC Approval Section for Developer Admin */}
          {adminType === "developer" && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-4">Pending KYC Applications</h2>
              {kycLoading ? (
                <p className="text-muted-foreground">Loading KYC applications...</p>
              ) : kycUsers.length === 0 ? (
                <p className="text-muted-foreground">No pending KYC applications.</p>
              ) : (
                <ul className="space-y-4">
                  {kycUsers.map(user => (
                    <li key={user.id} className="bg-muted/30 border border-border rounded-lg p-4 flex flex-col gap-2">
                      <div className="font-semibold">{user.name || `${user.firstName} ${user.lastName}`}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(user.id)}
                          disabled={processingId === user.id}
                          className="px-4 py-2 rounded bg-green-500/10 text-green-600 font-medium hover:bg-green-500/20 transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(user.id)}
                          disabled={processingId === user.id}
                          className="px-4 py-2 rounded bg-red-500/10 text-red-600 font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
