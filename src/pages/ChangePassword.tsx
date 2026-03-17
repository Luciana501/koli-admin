import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { updatePassword } from "firebase/auth";

const ChangePassword = () => {
  const { adminType, user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await updatePassword(user, newPassword);
      setSuccess("Password changed successfully.");
      // TODO: Update Firestore to mark mustChangePassword = false
    } catch (err) {
      setError("Failed to change password.");
    }
  };

  if (adminType !== "finance2" && adminType !== "kyc") {
    return <div>Unauthorized</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form onSubmit={handleChange} className="bg-card border rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">Change Password</h2>
        <div className="mb-4">
          <label className="block mb-2">New Password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        <div className="mb-4">
          <label className="block mb-2">Confirm Password</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
        </div>
        {error && <div className="text-red-500 mb-2">{error}</div>}
        {success && <div className="text-green-500 mb-2">{success}</div>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Change Password</button>
      </form>
    </div>
  );
};

export default ChangePassword;
