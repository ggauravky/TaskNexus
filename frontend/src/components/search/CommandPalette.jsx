import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Dialog from "../common/Dialog";
import useGlobalSearch from "../../hooks/useGlobalSearch";
import {
  SEARCH_GROUP_ORDER,
  flattenPaletteOptions,
  nextPaletteIndex,
  quickActionsFor,
  safeCommandTarget,
} from "../../utils/commandPalette";
import SearchResultGroup from "./SearchResultGroup";

const labels = Object.freeze({
  actions: "Quick actions",
  teams: "Teams",
  projects: "Projects",
  people: "People",
  hackathons: "Hackathons",
  opportunities: "Opportunities",
  organizations: "Organizations",
  tasks: "Marketplace tasks",
});

const CommandPalette = ({ onClose, role }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const search = useGlobalSearch(query, true);
  const actions = useMemo(
    () => (normalizedQuery.length < 2 ? quickActionsFor(role) : []),
    [normalizedQuery.length, role],
  );
  const options = useMemo(
    () => flattenPaletteOptions(actions, normalizedQuery.length >= 2 ? search.groups : {}),
    [actions, normalizedQuery.length, search.groups],
  );

  useEffect(() => {
    setActiveIndex(options.length ? 0 : -1);
  }, [options]);

  const select = (option) => {
    const target = safeCommandTarget(option?.target);
    if (!target) return;
    onClose();
    navigate(target);
  };
  const onKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setActiveIndex((current) => nextPaletteIndex(current, event.key, options.length));
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      select(options[activeIndex]);
    }
  };
  const indexedOptions = options.map((option, index) => ({ option, index }));
  const visibleGroups = ["actions", ...SEARCH_GROUP_ORDER]
    .map((group) => ({ group, options: indexedOptions.filter((entry) => entry.option.group === group) }))
    .filter((entry) => entry.options.length);
  const resultCount = options.filter((option) => option.kind === "result").length;
  const announcement = search.error
    ? search.error
    : normalizedQuery.length < 2
      ? "Quick actions available"
      : search.loading ? "Searching" : `${resultCount} search result${resultCount === 1 ? "" : "s"}`;

  return (
    <Dialog onClose={onClose} titleId="command-palette-title" descriptionId="command-palette-description" panelClassName="command-palette-panel overflow-hidden">
      <div className="command-palette-header">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-[#828fff]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="command-palette-title" className="sr-only">Search TaskNexus</h2>
            <p id="command-palette-description" className="sr-only">Search navigation and authorized workspace records</p>
            <input
              autoFocus
              role="combobox"
              aria-label="Search TaskNexus"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="command-palette-listbox"
              aria-activedescendant={activeIndex >= 0 ? `command-option-${activeIndex}` : undefined}
              className="command-palette-input"
              value={query}
              placeholder="Search teams, projects, people, and work…"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <kbd className="command-palette-escape" aria-hidden="true">Esc</kbd>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
      <div id="command-palette-listbox" role="listbox" aria-label="Search results" className="command-palette-results">
        {normalizedQuery.length >= 2 && search.loading ? (
          <div className="grid gap-2 p-3" aria-hidden="true">
            {[1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-[#1b1d20]" />)}
          </div>
        ) : null}
        {normalizedQuery.length >= 2 && search.error ? (
          <div className="command-palette-state" role="alert">
            <p>{search.error}</p>
            <button type="button" className="team-button-secondary mt-3" onClick={search.retry}>Try again</button>
          </div>
        ) : null}
        {!search.loading && !search.error ? visibleGroups.map(({ group, options: groupOptions }) => (
          <SearchResultGroup
            key={group}
            label={labels[group]}
            options={groupOptions}
            activeIndex={activeIndex}
            onActive={setActiveIndex}
            onSelect={select}
          />
        )) : null}
        {normalizedQuery.length >= 2 && !search.loading && !search.error && resultCount === 0 ? (
          <div className="command-palette-state">
            <p className="font-medium text-[#d0d6e0]">No results found</p>
            <p className="mt-1 text-sm text-[#62666d]">Try a more specific name or title.</p>
          </div>
        ) : null}
      </div>
      <div className="command-palette-footer" aria-hidden="true">
        <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
      </div>
    </Dialog>
  );
};

export default CommandPalette;
