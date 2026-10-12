import { ChevronLeft, ChevronRight } from "lucide-react";

export const WorkspaceHeader = ({ eyebrow, title, description, actions }) => (
  <header className="flex flex-col gap-5 border-b border-[#23252a] pb-7 sm:flex-row sm:items-end sm:justify-between">
    <div className="min-w-0">
      <p className="team-eyebrow">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8a8f98]">{description}</p>
    </div>
    <div className="flex flex-wrap gap-2">{actions}</div>
  </header>
);

export const MetricStrip = ({ items }) => (
  <section aria-label="Workspace summary" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] lg:grid-cols-4">
    {items.map((item) => (
      <div key={item.label} className="min-w-0 bg-[#0f1011] px-4 py-4 sm:px-5">
        <p className="truncate text-xs text-[#8a8f98]">{item.label}</p>
        <p className="mt-1 truncate text-xl font-semibold tracking-[-0.03em] text-[#f7f8f8] sm:text-2xl">{item.value}</p>
      </div>
    ))}
  </section>
);

export const SectionCard = ({ title, description, action, children, className = "" }) => (
  <section className={`rounded-xl border border-[#23252a] bg-[#0f1011] ${className}`}>
    <div className="flex flex-col gap-3 border-b border-[#23252a] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div>
        <h2 className="text-base font-medium text-[#f7f8f8]">{title}</h2>
        {description ? <p className="mt-1 text-xs leading-5 text-[#62666d]">{description}</p> : null}
      </div>
      {action}
    </div>
    <div className="p-4 sm:p-5">{children}</div>
  </section>
);

export const Pagination = ({ pagination, onPage, disabled = false }) => {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <nav className="mt-5 flex items-center justify-between border-t border-[#23252a] pt-4" aria-label="Pagination">
      <button type="button" disabled={disabled || !pagination.hasPrevious} onClick={() => onPage(pagination.page - 1)} className="team-button-secondary">
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <p className="text-xs text-[#8a8f98]">Page {pagination.page} of {pagination.totalPages}</p>
      <button type="button" disabled={disabled || !pagination.hasNext} onClick={() => onPage(pagination.page + 1)} className="team-button-secondary">
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};
