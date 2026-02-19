import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  deleteNewsPost,
  NewsPost,
  subscribeToNewsPosts,
  updateNewsPost,
} from "@/services/firestore";

const toDateTimeLocalValue = (isoValue: string) => {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const formatPostedAt = (isoValue: string) => {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NewsManage = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<NewsPost | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [postedAt, setPostedAt] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let unsubscribe = () => undefined;

    try {
      unsubscribe = subscribeToNewsPosts((data) => {
        setPosts(data);
        setLoading(false);
      });
    } catch (error) {
      console.error("Failed to subscribe to news posts:", error);
      setLoading(false);
      toast({
        title: "Could not load news posts",
        description: "Please refresh the page or check your connection.",
        variant: "destructive",
      });
    }

    return () => unsubscribe();
  }, [toast]);

  const totalPosts = useMemo(() => posts.length, [posts]);

  const handleOpenPost = (post: NewsPost) => {
    setSelectedPost(post);
    setTitle(post.title || "");
    setCategory(post.category || "");
    setDetails(post.details || "");
    setPostedAt(toDateTimeLocalValue(post.postedAt));
    setNewImageFile(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedPost) return;

    if (!title.trim() || !category.trim() || !details.trim() || !postedAt) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, category, details, and posted date-time.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateNewsPost(selectedPost.id, {
        title,
        category,
        details,
        postedAt,
        imageFile: newImageFile,
        currentImagePath: selectedPost.imagePath,
      });

      toast({
        title: "News updated",
        description: "News post has been updated successfully.",
      });

      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to update news",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPost) return;

    const shouldDelete = window.confirm(`Delete news post \"${selectedPost.title}\"?`);
    if (!shouldDelete) return;

    setDeleting(true);
    try {
      await deleteNewsPost(selectedPost.id, selectedPost.imagePath);
      toast({
        title: "News deleted",
        description: "News post has been deleted.",
      });
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to delete news",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">News List / Manage</h1>
        <p className="text-muted-foreground">View, edit, and delete existing news posts.</p>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold">Existing News Posts</h2>
          <p className="text-sm text-muted-foreground">Total posts: {totalPosts}</p>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-muted-foreground">Loading news posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-muted-foreground">No news posts yet.</p>
          ) : (
            posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => handleOpenPost(post)}
                className="w-full text-left border border-border rounded-lg p-3 md:p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="font-semibold truncate">{post.title}</p>
                    <p className="text-sm text-muted-foreground">Category: {post.category || "—"}</p>
                    <p className="text-sm text-muted-foreground">Posted: {formatPostedAt(post.postedAt)}</p>
                    <p className="text-sm line-clamp-2 text-muted-foreground">{post.details || "—"}</p>
                  </div>
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="w-full md:w-32 h-24 object-cover rounded border border-border"
                    />
                  ) : null}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage News Post</DialogTitle>
            <DialogDescription>View and update the selected news post.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              placeholder="News title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <Input
              placeholder="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
            <Input
              type="datetime-local"
              value={postedAt}
              onChange={(event) => setPostedAt(event.target.value)}
            />

            {selectedPost?.imageUrl ? (
              <img
                src={selectedPost.imageUrl}
                alt={selectedPost.title}
                className="w-full h-48 object-cover rounded border border-border"
              />
            ) : null}

            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setNewImageFile(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {newImageFile ? `New image selected: ${newImageFile.name}` : "No new image selected."}
            </p>

            <Textarea
              placeholder="Details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={6}
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
            <Button onClick={handleSave} disabled={saving || deleting}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewsManage;
