import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { TASK_TYPES, TASK_TYPE_LABELS } from "../../utils/constants";
import { apiError, formatCurrency } from "../../utils/marketplace";
import Dialog from "../common/Dialog";

const emptyForm = { title: "", description: "", category: "", budget: "", deadline: "", skillsRequired: "", experienceLevel: "intermediate" };
const templates = [
  { name: "Landing page refresh", title: "Landing page refresh", description: "Redesign an existing landing page with responsive layouts, accessible interactions, and documented handoff requirements.", category: "design", budget: 900, skillsRequired: "UI Design, Figma, Responsive Design" },
  { name: "API integration", title: "API integration and QA", description: "Integrate a third-party API into an existing application and deliver tested flows with documented edge-case coverage.", category: "web-development", budget: 1400, skillsRequired: "React, Node.js, API Integration, Testing" },
  { name: "Content campaign", title: "Content campaign package", description: "Create a multi-channel content package with long-form copy, social posts, and clear campaign messaging.", category: "writing", budget: 700, skillsRequired: "Copywriting, Content Strategy, SEO" },
];

const CreateTaskModal = ({ isOpen, onClose, onTaskCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => Object.values(TASK_TYPES).map((value) => [value, TASK_TYPE_LABELS[value]]), []);
  if (!isOpen) return null;
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const close = () => { if (!saving) { setForm(emptyForm); onClose(); } };
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await api.post("/tasks", {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        budget: Number(form.budget),
        skillsRequired: form.skillsRequired.split(",").map((skill) => skill.trim()).filter(Boolean),
      });
      toast.success("Task created and sent for marketplace review");
      setForm(emptyForm);
      await onTaskCreated?.(response.data.data);
    } catch (error) {
      toast.error(apiError(error, "Task could not be created"));
    } finally {
      setSaving(false);
    }
  };
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return <Dialog onClose={close} titleId="create-task-title" panelClassName="max-w-3xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#23252a] bg-[#0f1011]/95 px-5 py-4 backdrop-blur sm:px-6"><div><p className="team-eyebrow">Client workflow</p><h2 id="create-task-title" className="mt-1 text-xl font-semibold">Create task</h2></div><button type="button" onClick={close} disabled={saving} className="team-icon-button" aria-label="Close create task"><X className="h-4 w-4" /></button></div>
    <div className="border-b border-[#23252a] p-5 sm:px-6"><p className="text-sm font-medium">Start blank or use a template</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{templates.map(({ name, ...template }) => <button key={name} type="button" onClick={() => setForm((current) => ({ ...current, ...template }))} className="rounded-lg border border-[#34343a] bg-[#141516] p-3 text-left hover:border-[#5e6ad2]"><span className="block text-sm text-[#d0d6e0]">{name}</span><span className="mt-1 block text-xs text-[#62666d]">{formatCurrency(template.budget)}</span></button>)}</div></div>
    <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
      <label><span className="team-label">Title</span><input required minLength={5} maxLength={200} className="team-input" value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="Clear delivery outcome" /></label>
      <label><span className="team-label">Description</span><textarea required minLength={20} maxLength={5000} className="team-input min-h-32 resize-y" value={form.description} onChange={(event) => set("description", event.target.value)} placeholder="Requirements, constraints, and acceptance criteria" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="team-label">Category</span><select required className="team-input" value={form.category} onChange={(event) => set("category", event.target.value)}><option value="">Choose category</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="team-label">Experience level</span><select className="team-input" value={form.experienceLevel} onChange={(event) => set("experienceLevel", event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></label><label><span className="team-label">Budget (USD)</span><input required type="number" min="10" max="100000" step="0.01" className="team-input" value={form.budget} onChange={(event) => set("budget", event.target.value)} /></label><label><span className="team-label">Deadline</span><input required type="date" min={tomorrow} className="team-input" value={form.deadline} onChange={(event) => set("deadline", event.target.value)} /></label></div>
      <label><span className="team-label">Skills (comma separated)</span><input className="team-input" value={form.skillsRequired} onChange={(event) => set("skillsRequired", event.target.value)} placeholder="React, accessibility, testing" /></label>
      <div className="flex flex-col-reverse gap-2 border-t border-[#23252a] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={close} disabled={saving} className="team-button-secondary">Cancel</button><button disabled={saving} className="team-button-primary">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Create task</button></div>
    </form>
  </Dialog>;
};

export default CreateTaskModal;
