import { useEffect, useId, useRef, useState } from "react";
import { Check, Search, Star, X } from "lucide-react";
import api from "../../services/api";

const PROFICIENCIES = ["beginner", "intermediate", "advanced"];

const SkillPicker = ({ value, onChange, disabled = false }) => {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);
      try {
        const response = await api.get("/public/skills", { params: { q: query, limit: 12 } });
        if (requestRef.current !== requestId) return;
        const selected = new Set(value.map((skill) => skill.id));
        setResults((response.data.data || []).filter((skill) => !selected.has(skill.id)));
        setActiveIndex(0);
      } catch (_error) {
        if (requestRef.current === requestId) setResults([]);
      } finally {
        if (requestRef.current === requestId) setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  const addSkill = (skill) => {
    if (!skill || value.some((item) => item.id === skill.id)) return;
    onChange([...value, { ...skill, proficiency: "intermediate", isPrimary: false }]);
    setQuery("");
    setOpen(false);
  };

  const updateSkill = (id, updates) => {
    if (updates.isPrimary && value.filter((item) => item.isPrimary).length >= 5) return;
    onChange(value.map((skill) => skill.id === id ? { ...skill, ...updates } : skill));
  };

  const onKeyDown = (event) => {
    if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) setOpen(true);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      addSkill(results[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor={inputId} className="profile-label">Search the skill catalog</label>
        <Search className="pointer-events-none absolute bottom-3.5 left-3 h-4 w-4 text-[#8a8f98]" aria-hidden="true" />
        <input
          id={inputId}
          value={query}
          disabled={disabled}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIndex] ? `${listboxId}-${results[activeIndex].id}` : undefined}
          className="profile-input pl-10"
          placeholder="Try React, PostgreSQL, or mentoring"
        />
        {open ? (
          <div id={listboxId} role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-[#34343a] bg-[#141516] p-1 shadow-2xl">
            {loading ? <p className="px-3 py-3 text-sm text-[#8a8f98]">Searching catalog...</p> : null}
            {!loading && results.length === 0 ? <p className="px-3 py-3 text-sm text-[#8a8f98]">No additional skills found.</p> : null}
            {results.map((skill, index) => (
              <button
                id={`${listboxId}-${skill.id}`}
                key={skill.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addSkill(skill)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left ${index === activeIndex ? "bg-[#23252a] text-[#f7f8f8]" : "text-[#d0d6e0] hover:bg-[#18191a]"}`}
              >
                <span>
                  <span className="block text-sm font-medium">{skill.name}</span>
                  <span className="block text-xs text-[#8a8f98]">{skill.category}</span>
                </span>
                <Check className="h-4 w-4 text-[#828fff]" aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2" aria-live="polite">
        {value.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#34343a] px-4 py-5 text-sm text-[#8a8f98]">Add skills to show the tools and disciplines you work with.</p>
        ) : value.map((skill) => (
          <div key={skill.id} className="grid gap-3 rounded-xl border border-[#23252a] bg-[#0f1011] p-3 sm:grid-cols-[minmax(0,1fr)_150px_auto_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#f7f8f8]">{skill.name}</p>
              <p className="text-xs text-[#8a8f98]">{skill.category}</p>
            </div>
            <label className="sr-only" htmlFor={`${inputId}-${skill.id}-level`}>Proficiency for {skill.name}</label>
            <select
              id={`${inputId}-${skill.id}-level`}
              value={skill.proficiency}
              disabled={disabled}
              onChange={(event) => updateSkill(skill.id, { proficiency: event.target.value })}
              className="profile-input min-h-10 py-2 text-sm capitalize"
            >
              {PROFICIENCIES.map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <button
              type="button"
              disabled={disabled || (!skill.isPrimary && value.filter((item) => item.isPrimary).length >= 5)}
              onClick={() => updateSkill(skill.id, { isPrimary: !skill.isPrimary })}
              aria-pressed={skill.isPrimary}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-medium ${skill.isPrimary ? "border-[#5e6ad2] bg-[#5e6ad2]/15 text-[#b7bdf8]" : "border-[#34343a] text-[#d0d6e0] hover:bg-[#18191a]"}`}
            >
              <Star className={`h-3.5 w-3.5 ${skill.isPrimary ? "fill-current" : ""}`} aria-hidden="true" /> Primary
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((item) => item.id !== skill.id))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#8a8f98] hover:bg-[#23252a] hover:text-[#f7f8f8] focus:outline-none focus:ring-2 focus:ring-[#5e69d1]"
              aria-label={`Remove ${skill.name}`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8a8f98]">Up to 30 skills. Mark no more than 5 as primary.</p>
    </div>
  );
};

export default SkillPicker;
