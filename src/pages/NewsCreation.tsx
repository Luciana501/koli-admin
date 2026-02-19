import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createNewsPost } from "@/services/firestore";

const toDateTimeLocalValue = (date: Date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 16);
};

const NewsCreation = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [details, setDetails] = useState("");
  const [postedAt, setPostedAt] = useState(toDateTimeLocalValue(new Date()));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const imageName = useMemo(() => imageFile?.name || "No image selected", [imageFile]);

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setDetails("");
    setPostedAt(toDateTimeLocalValue(new Date()));
    setImageFile(null);
  };

  const handleCreateNews = async () => {
    if (!title.trim() || !category.trim() || !details.trim() || !postedAt || !imageFile) {
      toast({
        title: "Missing required fields",
        description: "Please fill in title, image, category, details, and posted date-time.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await createNewsPost({
        title,
        category,
        details,
        postedAt,
        imageFile,
      });

      toast({
        title: "News created",
        description: "The news post has been saved successfully.",
      });
      resetForm();
    } catch (error: any) {
      toast({
        title: "Failed to create news",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">News Creation</h1>
        <p className="text-muted-foreground">Create news posts for the Koli app.</p>
        <div className="mt-3">
          <Button variant="outline" onClick={() => navigate("/news/manage")}>Manage Existing News</Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create News</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setImageFile(file);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">Selected image: {imageName}</p>

        <Textarea
          placeholder="News details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={6}
        />

        <div className="flex justify-end">
          <Button onClick={handleCreateNews} disabled={saving}>
            {saving ? "Saving..." : "Create News"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewsCreation;
