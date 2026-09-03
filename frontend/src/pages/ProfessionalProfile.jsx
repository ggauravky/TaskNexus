import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, BookOpen, Check, ExternalLink, Eye, EyeOff, Globe2,
  GraduationCap, Loader2, MapPin, Plus, Save, Shield, Sparkles, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import SkillPicker from "../components/profile/SkillPicker";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const INTEREST_LABELS = {
  open_source: "Open source", startups: "Startups", ai_ml: "AI and ML",
  web_platform: "Web platform", mobile: "Mobile", data: "Data",
  devops: "DevOps", design_systems: "Design systems", accessibility: "Accessibility",
  developer_tools: "Developer tools", climate_tech: "Climate tech", education: "Education",
  data_science: "Data science", hackathons: "Hackathons", saas: "SaaS", cloud: "Cloud",
  cybersecurity: "Cybersecurity",
};
const ROLE_LABELS = {
  builder: "Builder", designer: "Designer", product_lead: "Product lead",
  project_lead: "Project lead", reviewer: "Reviewer", mentor: "Mentor",
  researcher: "Researcher", data_specialist: "Data specialist",
  frontend_developer: "Frontend developer", backend_developer: "Backend developer",
  full_stack_developer: "Full-stack developer", mobile_developer: "Mobile developer",
  ml_engineer: "ML engineer", data_analyst: "Data analyst", ui_ux_designer: "UI/UX designer",
  devops_engineer: "DevOps", qa_engineer: "QA", product: "Product",
};
const EMPTY_EDUCATION = {
  institution: "", degreeCourse: "", fieldOfStudy: "", startYear: "",
  endYear: "", currentlyStudying: false, description: "", position: 0,
};

const dashboardFor = (role) => role === "freelancer" ? "/freelancer/dashboard" : role === "admin" ? "/admin/dashboard" : "/client/dashboard";

const ProfessionalProfile = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [form, setForm] = useState(null);
  const [skills, setSkills] = useState([]);
  const [educationDraft, setEducationDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const response = await api.get("/profile");
    const data = response.data.data;
    setBundle(data);
    setForm({ ...data.profile, firstName: data.account.firstName, lastName: data.account.lastName });
    setSkills(data.skills || []);
  };

  useEffect(() => {
    load().catch(() => setError("We could not load your profile. Try again."));
  }, []);

  const dirty = useMemo(() => {
    if (!bundle || !form) return false;
    const baseline = { ...bundle.profile, firstName: bundle.account.firstName, lastName: bundle.account.lastName };
    return JSON.stringify(form) !== JSON.stringify(baseline) || JSON.stringify(skills) !== JSON.stringify(bundle.skills || []);
  }, [bundle, form, skills]);

  const updateField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const toggleListValue = (name, value) => {
    const current = form[name] || [];
    if (current.includes(value)) {
      updateField(name, current.filter((item) => item !== value));
      return;
    }
    const limit = name === "interests" ? 12 : 8;
    if (current.length >= limit) {
      toast.error(`Choose no more than ${limit} ${name === "interests" ? "interests" : "preferred roles"}`);
      return;
    }
    updateField(name, [...current, value]);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.put("/profile", form);
      await api.put("/profile/skills", {
        skills: skills.map((skill) => ({ skillId: skill.id, proficiency: skill.proficiency, isPrimary: skill.isPrimary })),
      });
      await load();
      updateUser({ ...user, profile: { ...user.profile, firstName: form.firstName, lastName: form.lastName, location: form.location, avatar: form.avatarUrl } });
      toast.success("Profile saved");
    } catch (requestError) {
      const message = requestError.response?.data?.error?.message || "Profile could not be saved";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const saveEducation = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...educationDraft,
        startYear: Number(educationDraft.startYear),
        endYear: educationDraft.currentlyStudying || !educationDraft.endYear ? null : Number(educationDraft.endYear),
      };
      if (educationDraft.id) await api.put(`/profile/education/${educationDraft.id}`, payload);
      else await api.post("/profile/education", payload);
      setEducationDraft(null);
      await load();
      toast.success("Education saved");
    } catch (requestError) {
      toast.error(requestError.response?.data?.error?.message || "Education could not be saved");
    }
  };

  const removeEducation = async (id) => {
    try {
      await api.delete(`/profile/education/${id}`);
      await load();
      toast.success("Education removed");
    } catch (_error) {
      toast.error("Education could not be removed");
    }
  };

  if (error && !bundle) return <ProfileState message={error} onRetry={() => { setError(""); load().catch(() => setError("We could not load your profile. Try again.")); }} />;
  if (!bundle || !form) return <ProfileState />;

  const publicUrl = form.username ? `/u/${form.username}` : null;
  const completion = bundle.completeness;

  return (
    <div className="profile-shell min-h-[100dvh] bg-[#010102] text-[#f7f8f8]">
      <header className="sticky top-0 z-30 border-b border-[#23252a] bg-[#010102]/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate(dashboardFor(user?.role))} className="profile-quiet-button">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Workspace
          </button>
          <div className="flex items-center gap-2">
            {publicUrl && form.visibility === "public" ? (
              <Link to={publicUrl} target="_blank" className="profile-quiet-button">
                View public profile <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : null}
            <button onClick={save} disabled={saving || !dirty} className="profile-primary-button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              {dirty ? "Save profile" : "Saved"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="grid gap-8 border-b border-[#23252a] pb-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
          <div>
            <p className="text-sm font-medium text-[#828fff]">Professional profile</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">Show collaborators how you think, build, and contribute.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#8a8f98]">Your public page contains only the fields shown in this editor. Account, security, and marketplace details stay private.</p>
          </div>
          <div className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-[#8a8f98]">Profile completeness</span>
              <strong className="text-2xl font-semibold">{completion.percentage}%</strong>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#23252a]" aria-label={`Profile ${completion.percentage}% complete`}>
              <div className="h-full rounded-full bg-[#5e6ad2]" style={{ width: `${completion.percentage}%` }} />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#8a8f98]">Based only on completed profile sections. Missing: {completion.missing.slice(0, 3).join(", ") || "none"}.</p>
            {!form.onboardingCompleted ? <Link to="/profile/onboarding" className="mt-4 inline-flex text-sm font-medium text-[#b7bdf8] hover:text-white">Finish guided setup</Link> : null}
          </div>
        </section>

        {error ? <div role="alert" className="mt-6 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</div> : null}

        <div className="mt-10 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <ProfileSection icon={Sparkles} title="Identity" description="Your name, addressable username, and one-line professional focus.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" value={form.firstName} onChange={(value) => updateField("firstName", value)} maxLength={50} />
                <Field label="Last name" value={form.lastName} onChange={(value) => updateField("lastName", value)} maxLength={50} />
                <Field label="Username" value={form.username || ""} onChange={(value) => updateField("username", value.toLowerCase())} prefix="tasknexus.app/u/" maxLength={30} hint="3-30 characters. Start with a letter." />
                <Field label="Headline" value={form.headline || ""} onChange={(value) => updateField("headline", value)} maxLength={120} />
                <div className="sm:col-span-2">
                  <label className="profile-label" htmlFor="profile-bio">Bio</label>
                  <textarea id="profile-bio" rows={6} value={form.bio || ""} onChange={(event) => updateField("bio", event.target.value)} maxLength={2000} className="profile-input resize-y" placeholder="Describe the problems you work on, the systems you know, and how you collaborate." />
                  <p className="mt-2 text-right text-xs text-[#62666d]">{(form.bio || "").length}/2000</p>
                </div>
              </div>
            </ProfileSection>

            <ProfileSection icon={MapPin} title="Collaboration" description="Set expectations without changing your account role or permissions.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Location" value={form.location || ""} onChange={(value) => updateField("location", value)} maxLength={120} />
                <Field label="Timezone" value={form.timezone || ""} onChange={(value) => updateField("timezone", value)} placeholder="Asia/Kolkata" maxLength={80} />
                <Select label="Availability" value={form.availability} onChange={(value) => updateField("availability", value)} options={{ open: "Open to collaborate", limited: "Limited availability", unavailable: "Not available" }} />
                <Select label="Time commitment" value={form.collaborationCommitment} onChange={(value) => updateField("collaborationCommitment", value)} options={{ exploring: "Exploring", few_hours: "A few hours weekly", part_time: "Part-time", full_time: "Full-time" }} />
              </div>
              <ChoiceGroup label="Interests" values={form.interests} options={INTEREST_LABELS} onToggle={(value) => toggleListValue("interests", value)} />
              <ChoiceGroup label="Preferred collaboration roles" values={form.preferredRoles} options={ROLE_LABELS} onToggle={(value) => toggleListValue("preferredRoles", value)} />
            </ProfileSection>

            <ProfileSection icon={BookOpen} title="Skills" description="Choose canonical skills, set proficiency, and identify up to five primary strengths.">
              <SkillPicker value={skills} onChange={setSkills} disabled={saving} />
            </ProfileSection>

            <ProfileSection icon={GraduationCap} title="Education" description="Add formal education, courses, or long-form programs that support your practice.">
              <div className="space-y-3">
                {bundle.education.map((item) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:flex-row sm:items-start sm:justify-between">
                    <button type="button" onClick={() => setEducationDraft(item)} className="text-left focus:outline-none focus:ring-2 focus:ring-[#5e69d1]">
                      <p className="font-medium text-[#f7f8f8]">{item.degreeCourse}</p>
                      <p className="mt-1 text-sm text-[#d0d6e0]">{item.institution}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""}</p>
                      <p className="mt-1 text-xs text-[#8a8f98]">{item.startYear} to {item.currentlyStudying ? "present" : item.endYear}</p>
                    </button>
                    <button type="button" onClick={() => removeEducation(item.id)} className="profile-icon-button" aria-label={`Remove ${item.degreeCourse}`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                ))}
                {bundle.education.length === 0 ? <p className="rounded-xl border border-dashed border-[#34343a] p-5 text-sm text-[#8a8f98]">No education entries yet.</p> : null}
                <button type="button" onClick={() => setEducationDraft({ ...EMPTY_EDUCATION })} className="profile-quiet-button"><Plus className="h-4 w-4" aria-hidden="true" /> Add education</button>
              </div>
              {educationDraft ? <EducationForm value={educationDraft} onChange={setEducationDraft} onCancel={() => setEducationDraft(null)} onSubmit={saveEducation} /> : null}
            </ProfileSection>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <ProfileSection icon={Globe2} title="Links" compact>
              <div className="space-y-4">
                <Field label="Avatar URL" type="url" value={form.avatarUrl || ""} onChange={(value) => updateField("avatarUrl", value)} placeholder="https://" />
                <Field label="GitHub" type="url" value={form.githubUrl || ""} onChange={(value) => updateField("githubUrl", value)} placeholder="https://github.com/..." />
                <Field label="LinkedIn" type="url" value={form.linkedinUrl || ""} onChange={(value) => updateField("linkedinUrl", value)} placeholder="https://linkedin.com/in/..." />
                <Field label="Portfolio" type="url" value={form.portfolioUrl || ""} onChange={(value) => updateField("portfolioUrl", value)} placeholder="https://" />
              </div>
            </ProfileSection>

            <ProfileSection icon={Shield} title="Privacy" compact>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Profile visibility">
                {[
                  ["public", Eye, "Public"],
                  ["private", EyeOff, "Private"],
                ].map(([value, Icon, label]) => (
                  <button key={value} type="button" onClick={() => updateField("visibility", value)} aria-pressed={form.visibility === value} className={`min-h-20 rounded-lg border p-3 text-left ${form.visibility === value ? "border-[#5e6ad2] bg-[#5e6ad2]/15 text-white" : "border-[#34343a] text-[#8a8f98] hover:bg-[#18191a]"}`}>
                    <Icon className="mb-2 h-4 w-4" aria-hidden="true" /><span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#8a8f98]">Private profiles return the same not-found response as missing profiles. Email, phone, account role, status, and marketplace data are never in the public DTO.</p>
            </ProfileSection>
          </aside>
        </div>
      </main>
    </div>
  );
};

const ProfileSection = ({ icon: Icon, title, description, compact = false, children }) => (
  <section className={`rounded-xl border border-[#23252a] bg-[#0f1011] ${compact ? "p-5" : "p-5 sm:p-7"}`}>
    <div className="mb-6 flex items-start gap-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#34343a] bg-[#18191a] text-[#b7bdf8]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
      <div><h2 className="text-lg font-medium tracking-[-0.02em] text-[#f7f8f8]">{title}</h2>{description ? <p className="mt-1 text-sm leading-6 text-[#8a8f98]">{description}</p> : null}</div>
    </div>
    {children}
  </section>
);

const Field = ({ label, value, onChange, hint, prefix, ...props }) => (
  <label className="block">
    <span className="profile-label">{label}</span>
    <span className="relative block">
      {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 text-xs text-[#62666d] sm:block">{prefix}</span> : null}
      <input {...props} value={value} onChange={(event) => onChange(event.target.value)} className={`profile-input ${prefix ? "sm:pl-32" : ""}`} />
    </span>
    {hint ? <span className="mt-2 block text-xs text-[#62666d]">{hint}</span> : null}
  </label>
);

const Select = ({ label, value, onChange, options }) => (
  <label className="block"><span className="profile-label">{label}</span><select className="profile-input" value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
);

const ChoiceGroup = ({ label, values = [], options, onToggle }) => (
  <fieldset className="mt-6"><legend className="profile-label">{label}</legend><div className="flex flex-wrap gap-2">{Object.entries(options).map(([value, text]) => <button key={value} type="button" aria-pressed={values.includes(value)} onClick={() => onToggle(value)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm ${values.includes(value) ? "border-[#5e6ad2] bg-[#5e6ad2]/15 text-[#f7f8f8]" : "border-[#34343a] text-[#8a8f98] hover:bg-[#18191a]"}`}>{values.includes(value) ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}{text}</button>)}</div></fieldset>
);

const EducationForm = ({ value, onChange, onCancel, onSubmit }) => {
  const set = (name, next) => onChange({ ...value, [name]: next });
  return <form onSubmit={onSubmit} className="mt-5 grid gap-4 rounded-xl border border-[#34343a] bg-[#141516] p-4 sm:grid-cols-2">
    <Field required label="Institution" value={value.institution} onChange={(next) => set("institution", next)} maxLength={160} />
    <Field required label="Degree or course" value={value.degreeCourse} onChange={(next) => set("degreeCourse", next)} maxLength={160} />
    <Field label="Field of study" value={value.fieldOfStudy || ""} onChange={(next) => set("fieldOfStudy", next)} maxLength={160} />
    <div className="grid grid-cols-2 gap-3"><Field required label="Start year" type="number" min="1900" max="2100" value={value.startYear} onChange={(next) => set("startYear", next)} /><Field label="End year" type="number" min="1900" max="2100" disabled={value.currentlyStudying} value={value.endYear || ""} onChange={(next) => set("endYear", next)} /></div>
    <label className="flex min-h-11 items-center gap-2 text-sm text-[#d0d6e0]"><input type="checkbox" checked={value.currentlyStudying} onChange={(event) => set("currentlyStudying", event.target.checked)} className="h-4 w-4 accent-[#5e6ad2]" /> I currently study here</label>
    <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={onCancel} className="profile-quiet-button">Cancel</button><button type="submit" className="profile-primary-button">Save education</button></div>
  </form>;
};

const ProfileState = ({ message, onRetry }) => <div className="flex min-h-[100dvh] items-center justify-center bg-[#010102] px-4 text-[#f7f8f8]">{message ? <div className="text-center"><p>{message}</p><button type="button" onClick={onRetry} className="profile-primary-button mt-4">Try again</button></div> : <Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading profile" />}</div>;

export default ProfessionalProfile;
