"use client";

import { useId, useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
};

export function CollapsibleSection({
  title,
  description,
  children,
  defaultOpen = false,
  className = "",
  contentClassName = "",
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section
      className={`rounded-lg border border-dashed border-stone-300 bg-stone-50/80 ${className}`}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            {title}
          </span>
          {description && (
            <span className="mt-1 block text-xs text-stone-500">
              {description}
            </span>
          )}
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-stone-600">
          {isOpen ? "Hide" : "Show"}
        </span>
      </button>
      {isOpen && (
        <div
          id={contentId}
          className={`border-t border-dashed border-stone-300 p-3 ${contentClassName}`}
        >
          {children}
        </div>
      )}
    </section>
  );
}
