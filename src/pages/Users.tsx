import React, { useState } from "react";
import { User } from "@/types/admin";
import { mockUsers } from "@/data/mockData";
import { IconSearch, IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import UserModal from "@/components/UserModal";

const Users = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const itemsPerPage = 5;

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

  const handleAddUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter((u) => u.id !== userId));
    }
  };

  const handleSaveUser = (userData: Omit<User, "id" | "createdAt">) => {
    if (editingUser) {
      setUsers(
        users.map((u) =>
          u.id === editingUser.id ? { ...u, ...userData } : u
        )
      );
    } else {
      const newUser: User = {
        ...userData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split("T")[0],
      };
      setUsers([...users, newUser]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">Manage your users</p>
        </div>
        <button
          onClick={handleAddUser}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
        >
          <IconPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <div className="relative max-w-sm">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Deposit
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
                    ${user.depositAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    ${user.totalAsset.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-1.5 rounded-md hover:bg-accent transition-colors"
                        aria-label="Edit user"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        aria-label="Delete user"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length > 0 && (
          <div className="p-4 border-t border-border">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No users found
          </div>
        )}
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
        user={editingUser}
      />
    </div>
  );
};

export default Users;
