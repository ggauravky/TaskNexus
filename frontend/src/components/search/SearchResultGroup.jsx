const SearchResultGroup = ({ label, options, activeIndex, onActive, onSelect }) => {
  if (!options.length) return null;
  const labelId = `command-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div role="group" aria-labelledby={labelId} className="command-palette-group">
      <h3 id={labelId} className="command-palette-group-label">{label}</h3>
      <div className="grid gap-1">
        {options.map(({ option, index }) => (
          <button
            id={`command-option-${index}`}
            key={`${option.kind}-${option.group}-${option.id}-${option.target}`}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
            className={`command-palette-option ${activeIndex === index ? "is-active" : ""}`}
            onMouseMove={() => onActive(index)}
            onFocus={() => onActive(index)}
            onClick={() => onSelect(option)}
          >
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-medium text-[#f7f8f8]">{option.title}</span>
              {option.subtitle ? <span className="mt-0.5 block truncate text-xs text-[#8a8f98]">{option.subtitle}</span> : null}
            </span>
            {option.status ? <span className="team-chip shrink-0 capitalize">{option.status.replaceAll("_", " ")}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchResultGroup;
