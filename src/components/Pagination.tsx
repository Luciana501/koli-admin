import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage, "...", totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex items-center gap-1">
      {getPageNumbers().map((page, index) => (
        <button
          key={index}
          onClick={() => typeof page === "number" && onPageChange(page)}
          disabled={page === "..."}
          className={`min-w-[36px] h-9 px-3 rounded-md text-sm font-medium transition-colors ${
            page === currentPage
              ? "bg-primary text-primary-foreground"
              : page === "..."
              ? "cursor-default text-muted-foreground"
              : "hover:bg-accent border border-border"
          }`}
        >
          {page}
        </button>
      ))}
    </div>
  );
};

export default Pagination;
