import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import SkillPicker from "../components/profile/SkillPicker";
import api from "../services/api";
import { toEditableProfile } from "../utils/profile";

const INTERESTS = ["open_source", "startups", "ai_ml", "web_platform", "mobile", "data", "data_science", "devops", "cloud", "cybersecurity", "saas", "hackathons", "design_systems", "accessibility", "developer_tools", "climate_tech", "education"];
const ROLES = ["frontend_developer", "backend_developer", "full_stack_developer", "mobile_developer", "ml_engineer", "data_analyst", "ui_ux_designer", "devops_engineer", "qa_engineer", "product", "builder", "designer", "product_lead", "project_lead", "reviewer", "mentor", "researcher", "data_specialist"];
const label = (value) => value.split("_").map((word) => word === "ai" || word === "ml" ? word.toUpperCase() : `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");

const ProfileOnboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [bundle, setBundle] = useState(null);
  const [form, setForm] = useState(null);
  const [skills, setSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/profile").then((response) => {
      const data = response.data.data;
      setBundle(data);
      setForm(toEditableProfile(data));
      setSkills(data.skills || []);
    }).catch(() => setError("Guided setup could not be loaded."));
  }, []);

  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const toggle = (name, value) => {
    if (form[name].includes(value)) {
      set(name, form[name].filter((item) => item !== value));
      return;
    }
    const limit = name === "interests" ? 12 : 8;
    if (form[name].length >= limit) {
      setError(`Choose no more than ${limit} ${name === "interests" ? "interests" : "preferred roles"}.`);
      return;
    }
    set(name, [...form[name], value]);
  };

  const next = async () => {
    setError("");
    if (step === 0 && !/^[a-z][a-z0-9_-]{2,29}$/.test(form.username || "")) {
      setError("Choose a valid username before continuing.");
      return;
    }
    setSaving(true);
    try {
      if (step === 2) {
        await api.put("/profile/skills", { skills: skills.map((skill) => ({ skillId: skill.id, proficiency: skill.proficiency, isPrimary: skill.isPrimary })) });
      } else {
        await api.put("/profile", form);
      }
      if (step < 3) setStep((current) => current + 1);
      else {
        await api.put("/profile/onboarding", form);
        toast.success("Your profile is ready");
        navigate("/profile");
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || "This step could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  if (!bundle || !form) return <div className="flex min-h-[100dvh] items-center justify-center bg-[#010102] text-[#f7f8f8]">{error || <Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading profile setup" />}</div>;

  return (
    <div className="min-h-[100dvh] bg-[#010102] text-[#f7f8f8]">
      <header className="border-b border-[#23252a]">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/profile")} className="profile-quiet-button"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Exit setup</button>
          <span className="text-sm text-[#8a8f98]">Step {step + 1} of 4</span>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[220px_minmax(0,1fr)] md:py-16">
        <aside>
          <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5e6ad2] text-white"><Sparkles className="h-4 w-4" aria-hidden="true" /></span><span className="font-medium">TaskNexus profile</span></div>
          <ol className="mt-8 space-y-1" aria-label="Setup progress">
            {["Identity", "Your practice", "Skills", "Preferences"].map((item, index) => <li key={item} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${index === step ? "bg-[#18191a] text-white" : index < step ? "text-[#b7bdf8]" : "text-[#62666d]"}`}>{index < step ? <Check className="h-4 w-4" aria-hidden="true" /> : <span className="w-4 text-center font-mono text-xs">{index + 1}</span>}{item}</li>)}
          </ol>
          <p className="mt-6 text-xs leading-5 text-[#62666d]">This setup is optional. You can leave now and finish any section later.</p>
        </aside>

        <section className="min-w-0 rounded-xl border border-[#23252a] bg-[#0f1011] p-5 sm:p-8">
          {step === 0 ? <Step title="Choose how people find you" copy="Your username becomes your public TaskNexus URL. It is unique and case-insensitive.">
            <div className="grid gap-4 sm:grid-cols-2"><OnboardingField label="First name" value={form.firstName} onChange={(value) => set("firstName", value)} /><OnboardingField label="Last name" value={form.lastName} onChange={(value) => set("lastName", value)} /><div className="sm:col-span-2"><OnboardingField label="Username" value={form.username || ""} onChange={(value) => set("username", value.toLowerCase())} placeholder="mira-builds" /><p className="mt-2 text-xs text-[#62666d]">Your URL: tasknexus.app/u/{form.username || "username"}</p></div></div>
          </Step> : null}
          {step === 1 ? <Step title="Describe your practice" copy="A concise headline and useful bio help collaborators understand your scope.">
            <div className="space-y-4"><OnboardingField label="Headline" value={form.headline || ""} onChange={(value) => set("headline", value)} maxLength={120} /><label className="block"><span className="profile-label">Bio</span><textarea className="profile-input" rows={6} maxLength={2000} value={form.bio || ""} onChange={(event) => set("bio", event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><OnboardingField label="Location" value={form.location || ""} onChange={(value) => set("location", value)} /><OnboardingField label="Timezone" value={form.timezone || ""} onChange={(value) => set("timezone", value)} placeholder="Asia/Kolkata" /></div></div>
          </Step> : null}
          {step === 2 ? <Step title="Add structured skills" copy="Select from the shared catalog so related spellings and aliases resolve to one skill."><SkillPicker value={skills} onChange={setSkills} disabled={saving} /></Step> : null}
          {step === 3 ? <Step title="Set collaboration preferences" copy="These preferences describe how you want to contribute. They do not change account permissions.">
            <fieldset><legend className="profile-label">Interests</legend><ChoiceGrid options={INTERESTS} selected={form.interests} onToggle={(value) => toggle("interests", value)} /></fieldset>
            <fieldset className="mt-6"><legend className="profile-label">Preferred roles</legend><ChoiceGrid options={ROLES} selected={form.preferredRoles} onToggle={(value) => toggle("preferredRoles", value)} /></fieldset>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="profile-label">Availability</span><select value={form.availability} onChange={(event) => set("availability", event.target.value)} className="profile-input"><option value="open">Open to collaborate</option><option value="limited">Limited availability</option><option value="unavailable">Not available</option></select></label>
              <label className="block"><span className="profile-label">Time commitment</span><select value={form.collaborationCommitment} onChange={(event) => set("collaborationCommitment", event.target.value)} className="profile-input"><option value="exploring">Exploring</option><option value="few_hours">A few hours weekly</option><option value="part_time">Part-time</option><option value="full_time">Full-time</option></select></label>
              <OnboardingField type="url" label="GitHub URL" value={form.githubUrl || ""} onChange={(value) => set("githubUrl", value)} placeholder="https://github.com/..." />
              <OnboardingField type="url" label="Portfolio URL" value={form.portfolioUrl || ""} onChange={(value) => set("portfolioUrl", value)} placeholder="https://" />
              <label className="block sm:col-span-2"><span className="profile-label">Visibility</span><select value={form.visibility} onChange={(event) => set("visibility", event.target.value)} className="profile-input"><option value="private">Private</option><option value="public">Public</option></select></label>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#62666d]">Links and education are optional. You can add LinkedIn and education entries from the full profile editor later.</p>
          </Step> : null}

          {error ? <p role="alert" className="mt-6 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#23252a] pt-6">
            <button type="button" disabled={step === 0 || saving} onClick={() => setStep((current) => current - 1)} className="profile-quiet-button">Back</button>
            <button type="button" disabled={saving} onClick={next} className="profile-primary-button">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{step === 3 ? "Finish setup" : "Save and continue"}{!saving && step < 3 ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}</button>
          </div>
        </section>
      </main>
    </div>
  );
};

const Step = ({ title, copy, children }) => <div><h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8a8f98]">{copy}</p><div className="mt-7">{children}</div></div>;
const OnboardingField = ({ label: fieldLabel, value, onChange, ...props }) => <label className="block"><span className="profile-label">{fieldLabel}</span><input {...props} className="profile-input" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
const ChoiceGrid = ({ options, selected = [], onToggle }) => <div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <button key={option} type="button" aria-pressed={selected.includes(option)} onClick={() => onToggle(option)} className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-left text-sm ${selected.includes(option) ? "border-[#5e6ad2] bg-[#5e6ad2]/15 text-white" : "border-[#34343a] text-[#8a8f98] hover:bg-[#18191a]"}`}>{label(option)}{selected.includes(option) ? <Check className="h-4 w-4" aria-hidden="true" /> : null}</button>)}</div>;

export default ProfileOnboarding;
