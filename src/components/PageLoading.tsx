import React from "react";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  className?: string;
}

const PageLoading = ({ className }: PageLoadingProps) => {
  return (
    <div className={cn("min-h-[60vh] flex items-center justify-center", className)}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
    </div>
  );
};

export default PageLoading;
