import React, { useState, useEffect } from "react";
import { User } from "@/types/admin";
import { subscribeToUsers } from "@/services/firestore";
import { IconSearch, IconEye } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import UserModal from "@/components/UserModal";

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const filteredUsers = users.filter(
    (user) =>
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleViewUser = (user: User) => {
    setViewingUser(user);
    setIsModalOpen(true);
  };
  // Get the latest user data from the users array when modal is open
  const modalUser = viewingUser 
    ? users.find(u => u.id === viewingUser.id) || viewingUser 
    : null;
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Users</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage your users</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-3 md:p-4 border-b border-border">
          <div className="relative max-w-full md:max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 text-sm md:text-base rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[400px] md:max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading users...</p>
            </div>
          ) : paginatedUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  First Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Last Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Phone Number
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Email
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Address
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Donation
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Total Asset
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((user, index) => (
                <tr
                  key={user.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">{startIndex + index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {user.firstName}
                  </td>
                  <td className="px-4 py-3 text-sm">{user.lastName}</td>
                  <td className="px-4 py-3 text-sm">{user.phoneNumber}</td>
                  <td className="px-4 py-3 text-sm">{user.email}</td>
                  <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                    {user.address}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    ₱{user.donationAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    ₱{user.totalAsset.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewUser(user)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                      aria-label="View user"
                    >
                      <IconEye className="h-4 w-4" />
                      View User
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {!loading && filteredUsers.length > 0 && (
          <div className="p-4 border-t border-border flex justify-end">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <UserModal
        key={modalUser?.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={modalUser}
      />
    </div>
  );
};

export default Users;
