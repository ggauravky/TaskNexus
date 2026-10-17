import { forwardRef } from "react";
import { Search } from "lucide-react";

const SearchTrigger = forwardRef(function SearchTrigger({ onClick }, ref) {
  const isApplePlatform = typeof navigator !== "undefined"
    && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

  return (
    <button
      ref={ref}
      type="button"
      className="command-palette-trigger"
      aria-label="Search TaskNexus"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onClick}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="command-palette-trigger-label">Search</span>
      <kbd className="command-palette-shortcut" aria-hidden="true">
        {isApplePlatform ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
});

export default SearchTrigger;
