import React from 'react';

// Single Book Card Skeleton (matches KindleBookCard)
export const BookCardSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col bg-white border border-gray-200 rounded-lg p-3.5 shadow-sm relative overflow-hidden">
      {/* 3D Cover Skeleton with Spine & Edge Placeholder */}
      <div className="w-full aspect-[2/3] max-h-64 sm:max-h-72 mx-auto rounded-r-lg rounded-l-xs relative overflow-hidden mb-3 bg-gray-100 animate-shimmer">
        <div className="book-spine-effect opacity-40" />
        <div className="book-page-edge opacity-50" />
      </div>

      {/* Title (2 lines) */}
      <div className="space-y-1.5 mb-2">
        <div className="h-3.5 bg-gray-200 rounded-md w-11/12 animate-shimmer" />
        <div className="h-3.5 bg-gray-200 rounded-md w-3/4 animate-shimmer" />
      </div>

      {/* Author */}
      <div className="h-2.5 bg-gray-200 rounded-md w-1/2 mb-3 animate-shimmer" />

      {/* Rating stars placeholder */}
      <div className="flex items-center gap-1 mb-3">
        <div className="h-3 w-16 bg-amber-100 rounded-md animate-shimmer" />
        <div className="h-2.5 w-6 bg-gray-200 rounded-md" />
      </div>

      {/* Badges & Button placeholder */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between">
        <div className="h-4 w-16 bg-gray-100 rounded-full animate-shimmer" />
        <div className="h-6 w-14 bg-gray-200 rounded-md animate-shimmer" />
      </div>
    </div>
  );
};

// Hero Feature Spotlight Skeleton (matches KindleHeroFeature)
export const HeroFeatureSkeleton: React.FC = () => {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
      <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
        {/* Book Jacket on the left */}
        <div className="shrink-0">
          <div className="w-44 sm:w-52 aspect-[2/3] rounded-r-xl rounded-l-sm bg-gray-200 book-card-shadow relative overflow-hidden border-r border-t border-b border-gray-300 animate-shimmer">
            <div className="book-spine-effect opacity-50" />
            <div className="book-page-edge opacity-60" />
          </div>
        </div>

        {/* Book Metadata & Description on the right */}
        <div className="flex-1 w-full space-y-4">
          {/* Eyebrow badge */}
          <div className="flex items-center gap-3">
            <div className="h-5 w-36 bg-amber-100 rounded-full animate-shimmer" />
            <div className="h-5 w-24 bg-gray-100 rounded-full animate-shimmer" />
          </div>

          {/* Big Title */}
          <div className="space-y-2">
            <div className="h-7 sm:h-8 bg-gray-200 rounded-lg w-4/5 animate-shimmer" />
            <div className="h-7 sm:h-8 bg-gray-200 rounded-lg w-2/5 animate-shimmer" />
          </div>

          {/* Author and Star Rating */}
          <div className="flex items-center gap-4">
            <div className="h-4 w-32 bg-gray-200 rounded-md animate-shimmer" />
            <div className="h-4 w-24 bg-amber-100 rounded-md animate-shimmer" />
          </div>

          {/* Description paragraphs */}
          <div className="space-y-2 pt-2">
            <div className="h-3.5 bg-gray-200 rounded-md w-full animate-shimmer" />
            <div className="h-3.5 bg-gray-200 rounded-md w-11/12 animate-shimmer" />
            <div className="h-3.5 bg-gray-200 rounded-md w-4/5 animate-shimmer" />
          </div>

          {/* Takeaways chips */}
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="h-6 w-28 bg-gray-100 rounded-full animate-shimmer" />
            <div className="h-6 w-36 bg-gray-100 rounded-full animate-shimmer" />
            <div className="h-6 w-24 bg-gray-100 rounded-full animate-shimmer" />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
            <div className="h-10 w-28 bg-amber-300/70 rounded-md animate-shimmer" />
            <div className="h-10 w-36 bg-gray-200 rounded-md animate-shimmer" />
            <div className="h-10 w-32 bg-gray-200 rounded-md animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Bookstore Shelves Skeleton (matches BookstoreShelves view)
export const BookstoreShelvesSkeleton: React.FC<{ shelfCount?: number }> = ({ shelfCount = 2 }) => {
  return (
    <div className="space-y-10 py-4">
      {Array.from({ length: shelfCount }).map((_, idx) => (
        <div key={idx} className="space-y-4">
          {/* Category Shelf Header */}
          <div className="flex items-center justify-between border-b border-gray-200 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gray-200 animate-shimmer" />
              <div className="space-y-1.5">
                <div className="h-5 w-44 bg-gray-200 rounded-md animate-shimmer" />
                <div className="h-3 w-32 bg-gray-100 rounded-md animate-shimmer" />
              </div>
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded-md animate-shimmer" />
          </div>

          {/* Book Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, bIdx) => (
              <BookCardSkeleton key={bIdx} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Book Grid Skeleton (matches 3D Gallery Grid)
export const BookGridSkeleton: React.FC<{ count?: number }> = ({ count = 10 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
      {Array.from({ length: count }).map((_, idx) => (
        <BookCardSkeleton key={idx} />
      ))}
    </div>
  );
};

// Book Table Skeleton (matches Financial Index Table)
export const BookTableSkeleton: React.FC<{ rowCount?: number }> = ({ rowCount = 7 }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-400 font-semibold border-b border-gray-200 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Title & Author</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">Difficulty</th>
              <th className="py-3 px-4">Channel File</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Array.from({ length: rowCount }).map((_, idx) => (
              <tr key={idx} className="animate-pulse">
                <td className="py-3 px-4">
                  <div className="h-4 bg-gray-200 rounded w-48 mb-1.5" />
                  <div className="h-3 bg-gray-100 rounded w-28" />
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 bg-gray-100 rounded-full w-24" />
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 bg-amber-100 rounded w-14" />
                </td>
                <td className="py-3 px-4">
                  <div className="h-4 bg-gray-100 rounded w-16" />
                </td>
                <td className="py-3 px-4">
                  <div className="h-5 bg-gray-100 rounded w-20" />
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex gap-2">
                    <div className="h-7 w-12 bg-gray-200 rounded" />
                    <div className="h-7 w-16 bg-gray-100 rounded" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Wishlist / Requests Queue Skeleton
export const RequestsQueueSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="h-5 bg-gray-200 rounded-md w-3/4 animate-shimmer" />
              <div className="h-3 bg-gray-100 rounded-md w-1/3 animate-shimmer" />
            </div>
            <div className="h-5 w-20 bg-amber-100 rounded-full animate-shimmer" />
          </div>
          <div className="p-3 bg-gray-50 rounded-xl space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full animate-shimmer" />
            <div className="h-3 bg-gray-200 rounded w-2/3 animate-shimmer" />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="h-7 w-24 bg-gray-100 rounded-lg animate-shimmer" />
            <div className="h-7 w-20 bg-emerald-100 rounded-lg animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Analytics Metrics Skeleton (matches AnalyticsView cards)
export const AnalyticsMetricsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-3 w-28 bg-gray-200 rounded animate-shimmer" />
              <div className="h-9 w-9 rounded-xl bg-gray-100 animate-shimmer" />
            </div>
            <div className="mt-3 h-8 w-20 bg-gray-300 rounded animate-shimmer" />
            <div className="mt-2 h-2.5 w-32 bg-gray-100 rounded animate-shimmer" />
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="h-5 w-48 bg-gray-200 rounded animate-shimmer" />
        <div className="h-4 w-96 bg-gray-100 rounded animate-shimmer" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-16 bg-gray-50 rounded-lg animate-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
};

// Valuation Lab Quote & Fair Value Skeleton
export const ValuationQuoteSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6 animate-pulse">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-7 w-48 bg-gray-200 rounded-md animate-shimmer" />
            <div className="h-5 w-16 bg-blue-100 rounded animate-shimmer" />
            <div className="h-5 w-12 bg-gray-100 rounded animate-shimmer" />
          </div>
          <div className="h-3 w-64 bg-gray-100 rounded animate-shimmer" />
        </div>

        <div className="flex items-center gap-8">
          <div className="space-y-1">
            <div className="h-2.5 w-24 bg-gray-200 rounded" />
            <div className="h-8 w-28 bg-gray-300 rounded animate-shimmer" />
          </div>
          <div className="space-y-1 pl-6 border-l border-gray-200">
            <div className="h-2.5 w-28 bg-gray-200 rounded" />
            <div className="h-8 w-32 bg-blue-200 rounded animate-shimmer" />
          </div>
          <div className="h-8 w-28 bg-emerald-100 rounded-md animate-shimmer" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        <div className="h-28 bg-gray-50 rounded-xl p-4 animate-shimmer" />
        <div className="h-28 bg-gray-50 rounded-xl p-4 animate-shimmer" />
        <div className="h-28 bg-gray-50 rounded-xl p-4 animate-shimmer" />
      </div>
    </div>
  );
};

// Academic Paper Search Results Skeleton
export const AcademicPaperSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-gray-200 rounded w-11/12 animate-shimmer" />
              <div className="h-4 bg-gray-200 rounded w-2/3 animate-shimmer" />
            </div>
            <div className="h-5 w-16 bg-blue-100 rounded animate-shimmer" />
          </div>
          <div className="h-3 w-40 bg-gray-100 rounded animate-shimmer" />
          <div className="space-y-1.5 pt-1">
            <div className="h-2.5 bg-gray-100 rounded w-full animate-shimmer" />
            <div className="h-2.5 bg-gray-100 rounded w-5/6 animate-shimmer" />
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="h-6 w-24 bg-gray-100 rounded animate-shimmer" />
            <div className="h-7 w-28 bg-amber-200 rounded-md animate-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
};
