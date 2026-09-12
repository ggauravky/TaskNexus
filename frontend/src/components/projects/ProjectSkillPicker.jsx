import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import api from "../../services/api";

const ProjectSkillPicker = ({ value, onChange, disabled = false }) => {
  const id = useId();
  const request = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(async () => {
      const current = ++request.current;
      try {
        const response = await api.get("/public/skills", { params: { q: query, limit: 12 } });
        if (request.current === current) setResults((response.data.data || []).filter((item) => !value.some((skill) => skill.id === item.id)));
      } catch { if (request.current === current) setResults([]); }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [open, query, value]);
  const add = (skill) => { if (value.length < 12) onChange([...value, skill]); setQuery(""); setOpen(false); };
  return <div className="relative"><label htmlFor={id} className="team-label">Technologies / skills</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#62666d]" /><input id={id} disabled={disabled} value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} className="team-input pl-10" role="combobox" aria-expanded={open} placeholder="Search the canonical skill catalog" /></div>{open ? <div role="listbox" className="absolute z-30 mt-2 max-h-56 w-full overflow-y-auto rounded-xl border border-[#34343a] bg-[#141516] p-1">{results.length ? results.map((skill) => <button key={skill.id} type="button" role="option" aria-selected="false" onMouseDown={(event) => event.preventDefault()} onClick={() => add(skill)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#d0d6e0] hover:bg-[#23252a] hover:text-white"><span className="font-medium">{skill.name}</span><span className="ml-2 text-xs text-[#62666d]">{skill.category}</span></button>) : <p className="px-3 py-3 text-sm text-[#62666d]">No additional skills found.</p>}</div> : null}<div className="mt-2 flex flex-wrap gap-2">{value.map((skill) => <span key={skill.id} className="team-chip text-[#d0d6e0]">{skill.name}<button type="button" onClick={() => onChange(value.filter((item) => item.id !== skill.id))} aria-label={`Remove ${skill.name}`}><X className="h-3 w-3" /></button></span>)}</div></div>;
};

export default ProjectSkillPicker;
