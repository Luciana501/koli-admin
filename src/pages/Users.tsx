import React, { useState, useEffect } from "react";
import { User } from "@/types/admin";
import { subscribeToUsers, createUser, updateUser, deleteUser } from "@/services/firestore";
import { IconSearch, IconEye, IconFilter, IconX, IconEdit, IconTrash, IconPlus } from "@tabler/icons-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import UserModal from "@/components/UserModal";
import UserFormModal from "@/components/UserFormModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  
  // Form modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Delete dialog states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  const { toast } = useToast();
  
  // Filter states
  const [assetFilter, setAssetFilter] = useState("all");
  const [donationFilter, setDonationFilter] = useState("all");
  const [kycStatusFilter, setKycStatusFilter] = useState("all");
  const [minAsset, setMinAsset] = useState("");
  const [maxAsset, setMaxAsset] = useState("");
  const [minDonation, setMinDonation] = useState("");
  const [maxDonation, setMaxDonation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
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

  const filteredUsers = users.filter((user) => {
    // Text search filter
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phoneNumber.includes(searchTerm) ||
      user.address.toLowerCase().includes(searchTerm.toLowerCase());

    // Asset filter
    let matchesAsset = true;
    if (assetFilter && assetFilter !== "all") {
      switch (assetFilter) {
        case "low":
          matchesAsset = user.totalAsset < 50000;
          break;
        case "medium":
          matchesAsset = user.totalAsset >= 50000 && user.totalAsset < 200000;
          break;
        case "high":
          matchesAsset = user.totalAsset >= 200000;
          break;
      }
    }

    // Custom asset range
    if (minAsset && user.totalAsset < parseFloat(minAsset)) matchesAsset = false;
    if (maxAsset && user.totalAsset > parseFloat(maxAsset)) matchesAsset = false;

    // Donation filter
    let matchesDonation = true;
    if (donationFilter && donationFilter !== "all") {
      switch (donationFilter) {
        case "low":
          matchesDonation = user.donationAmount < 10000;
          break;
        case "medium":
          matchesDonation = user.donationAmount >= 10000 && user.donationAmount < 50000;
          break;
        case "high":
          matchesDonation = user.donationAmount >= 50000;
          break;
      }
    }

    // Custom donation range
    if (minDonation && user.donationAmount < parseFloat(minDonation)) matchesDonation = false;
    if (maxDonation && user.donationAmount > parseFloat(maxDonation)) matchesDonation = false;

    // KYC status filter
    let matchesKyc = true;
    if (kycStatusFilter && kycStatusFilter !== "all") {
      if (kycStatusFilter === "NOT_SUBMITTED") {
        matchesKyc = !user.kycStatus || user.kycStatus === "NOT_SUBMITTED";
      } else {
        matchesKyc = user.kycStatus === kycStatusFilter;
      }
    }

    return matchesSearch && matchesAsset && matchesDonation && matchesKyc;
  });

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
  
  const clearFilters = () => {
    setAssetFilter("all");
    setDonationFilter("all");
    setKycStatusFilter("all");
    setMinAsset("");
    setMaxAsset("");
    setMinDonation("");
    setMaxDonation("");
    setSearchTerm("");
    setCurrentPage(1);
  };
  
  const handleCreateUser = () => {
    setFormMode("create");
    setEditingUser(null);
    setIsFormModalOpen(true);
  };
  
  const handleEditUser = (user: User) => {
    setFormMode("edit");
    setEditingUser(user);
    setIsFormModalOpen(true);
  };
  
  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      if (formMode === "create") {
        await createUser(userData as Omit<User, "id" | "createdAt">);
        toast({
          title: "Success",
          description: "User created successfully",
        });
      } else if (formMode === "edit" && editingUser) {
        await updateUser(editingUser.id, userData);
        toast({
          title: "Success",
          description: "User updated successfully",
        });
      }
      setIsFormModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error("Error saving user:", error);
      toast({
        title: "Error",
        description: `Failed to ${formMode === "create" ? "create" : "update"} user`,
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    
    try {
      await deleteUser(deletingUser.id);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };
  
  // Get the latest user data from the users array when modal is open
  const modalUser = viewingUser 
    ? users.find(u => u.id === viewingUser.id) || viewingUser 
    : null;
  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Users</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage your users</p>
        </div>
        <Button onClick={handleCreateUser} className="flex items-center gap-2">
          <IconPlus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-3 md:p-4 border-b border-border space-y-4">
          {/* Search and Filter Toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search users by name, email, phone, or address..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <IconFilter className="h-4 w-4" />
                Filters
                {(assetFilter !== "all" || donationFilter !== "all" || kycStatusFilter !== "all" || minAsset || maxAsset || minDonation || maxDonation) && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
              {(assetFilter !== "all" || donationFilter !== "all" || kycStatusFilter !== "all" || minAsset || maxAsset || minDonation || maxDonation || searchTerm) && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <IconX className="h-4 w-4" />
                </Button>
              )}
              <div className="text-sm font-medium text-muted-foreground ml-2">
                Total Users: {filteredUsers.length}
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Asset Filters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Asset</label>
                  <Select value={assetFilter} onValueChange={setAssetFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assets</SelectItem>
                      <SelectItem value="low">Low (&lt; ₱50K)</SelectItem>
                      <SelectItem value="medium">Medium (₱50K - ₱200K)</SelectItem>
                      <SelectItem value="high">High (₱200K+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Donation Filters */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Donation Amount</label>
                  <Select value={donationFilter} onValueChange={setDonationFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Donations</SelectItem>
                      <SelectItem value="low">Low (&lt; ₱10K)</SelectItem>
                      <SelectItem value="medium">Medium (₱10K - ₱50K)</SelectItem>
                      <SelectItem value="high">High (₱50K+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Asset Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Asset Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minAsset}
                      onChange={(e) => setMinAsset(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxAsset}
                      onChange={(e) => setMaxAsset(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* KYC Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">KYC Status</label>
                  <Select value={kycStatusFilter} onValueChange={setKycStatusFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="NOT_SUBMITTED">Not Submitted</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Donation Range */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Custom Donation Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minDonation}
                      onChange={(e) => setMinDonation(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxDonation}
                      onChange={(e) => setMaxDonation(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Showing {filteredUsers.length} of {users.length} users
              </div>
            </div>
          )}
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
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border">
              {paginatedUsers.map((user, index) => (
                <div key={user.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {startIndex + index + 1}. {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="inline-flex items-center p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                        aria-label="View user"
                      >
                        <IconEye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="inline-flex items-center p-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors"
                        aria-label="Edit user"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="inline-flex items-center p-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        aria-label="Delete user"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Phone: </span>
                      <span>{user.phoneNumber || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Donation: </span>
                      <span>₱{user.donationAmount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Asset: </span>
                      <span className="font-medium">₱{user.totalAsset.toLocaleString()}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-muted-foreground">Address: </span>
                      <span>{user.address || "—"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <table className="w-full min-w-[800px] hidden md:table">
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                        aria-label="View user"
                      >
                        <IconEye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 transition-colors text-sm font-medium"
                        aria-label="Edit user"
                      >
                        <IconEdit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors text-sm font-medium"
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
          </>
          )}
        </div>

        {!loading && filteredUsers.length > 0 && (
          <div className="p-4 border-t border-border flex justify-end">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={page === currentPage}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <UserModal
        key={modalUser?.id}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={modalUser}
      />
      
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingUser(null);
        }}
        onSave={handleSaveUser}
        user={editingUser}
        mode={formMode}
      />
      
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete user <strong>{deletingUser?.firstName} {deletingUser?.lastName}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Users;
