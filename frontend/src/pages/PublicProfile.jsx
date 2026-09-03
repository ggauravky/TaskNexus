import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, BookOpen, Briefcase, Clock3, Github, Globe2,
  Linkedin, Loader2, MapPin,
} from "lucide-react";
import PublicNavigation from "../components/marketing/PublicNavigation";
import api from "../services/api";

const AVAILABILITY = { open: "Open to collaborate", limited: "Limited availability", unavailable: "Not available" };
const COMMITMENT = { exploring: "Exploring options", few_hours: "A few hours weekly", part_time: "Part-time", full_time: "Full-time" };
const LABELS = {
  open_source: "Open source", startups: "Startups", ai_ml: "AI and ML",
  web_platform: "Web platform", mobile: "Mobile", data: "Data", devops: "DevOps",
  design_systems: "Design systems", accessibility: "Accessibility",
  developer_tools: "Developer tools", climate_tech: "Climate tech", education: "Education",
  data_science: "Data science", hackathons: "Hackathons", saas: "SaaS", cloud: "Cloud",
  cybersecurity: "Cybersecurity",
  builder: "Builder", designer: "Designer", product_lead: "Product lead",
  project_lead: "Project lead", reviewer: "Reviewer", mentor: "Mentor",
  researcher: "Researcher", data_specialist: "Data specialist",
  frontend_developer: "Frontend developer", backend_developer: "Backend developer",
  full_stack_developer: "Full-stack developer", mobile_developer: "Mobile developer",
  ml_engineer: "ML engineer", data_analyst: "Data analyst", ui_ux_designer: "UI/UX designer",
  devops_engineer: "DevOps", qa_engineer: "QA", product: "Product",
};

const PublicProfile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let active = true;
    api.get(`/public/profiles/${encodeURIComponent(username)}`)
      .then((response) => {
        if (!active) return;
        setProfile(response.data.data);
        setState("ready");
        document.title = `${response.data.data.name.display} | TaskNexus`;
      })
      .catch(() => { if (active) setState("missing"); });
    return () => { active = false; };
  }, [username]);

  if (state === "loading") return <div className="flex min-h-[100dvh] items-center justify-center bg-[#010102] text-[#f7f8f8]"><Loader2 className="h-7 w-7 animate-spin text-[#828fff]" aria-label="Loading public profile" /></div>;
  if (state === "missing") return <div className="min-h-[100dvh] bg-[#010102] text-[#f7f8f8]"><header className="border-b border-[#23252a]"><PublicNavigation dark /></header><main className="mx-auto flex max-w-3xl flex-col items-start px-4 py-24 sm:px-6"><p className="text-sm font-medium text-[#828fff]">Profile unavailable</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">This profile is private or does not exist.</h1><p className="mt-4 text-[#8a8f98]">We use the same response for both states to protect member privacy.</p><Link to="/" className="profile-quiet-button mt-8"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to TaskNexus</Link></main></div>;

  const initials = `${profile.name.first?.[0] || ""}${profile.name.last?.[0] || ""}`.toUpperCase() || "TN";
  const primarySkills = profile.skills.filter((skill) => skill.isPrimary);
  const otherSkills = profile.skills.filter((skill) => !skill.isPrimary);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#010102] text-[#f7f8f8]">
      <header className="border-b border-[#23252a]"><PublicNavigation dark /></header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <section className="grid gap-8 border-b border-[#23252a] pb-12 md:grid-cols-[minmax(0,1fr)_260px] md:items-start">
          <div className="min-w-0">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-2xl border border-[#34343a] object-cover" /> : <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-[#34343a] bg-[#141516] text-2xl font-semibold tracking-[-0.04em] text-[#b7bdf8]" aria-hidden="true">{initials}</div>}
              <div className="min-w-0">
                <p className="truncate text-sm text-[#828fff]">@{profile.username}</p>
                <h1 className="mt-1 break-words text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{profile.name.display}</h1>
              </div>
            </div>
            <p className="mt-7 max-w-3xl text-xl leading-8 tracking-[-0.015em] text-[#d0d6e0] sm:text-2xl">{profile.headline || "TaskNexus collaborator"}</p>
            {profile.bio ? <p className="mt-5 max-w-3xl whitespace-pre-wrap text-base leading-7 text-[#8a8f98]">{profile.bio}</p> : null}
          </div>

          <aside className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5">
            <h2 className="text-sm font-medium text-[#f7f8f8]">Collaboration details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <Meta icon={Briefcase} label="Availability" value={AVAILABILITY[profile.availability]} />
              <Meta icon={Clock3} label="Commitment" value={COMMITMENT[profile.collaborationCommitment]} />
              {profile.location ? <Meta icon={MapPin} label="Location" value={profile.location} /> : null}
              {profile.timezone ? <Meta icon={Globe2} label="Timezone" value={profile.timezone} /> : null}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-[#23252a] pt-5">
              {profile.links.github ? <SocialLink href={profile.links.github} label="GitHub" icon={Github} /> : null}
              {profile.links.linkedin ? <SocialLink href={profile.links.linkedin} label="LinkedIn" icon={Linkedin} /> : null}
              {profile.links.portfolio ? <SocialLink href={profile.links.portfolio} label="Portfolio" icon={Globe2} /> : null}
            </div>
          </aside>
        </section>

        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-12">
            <PublicSection title="Primary skills" count={primarySkills.length}>
              <div className="grid gap-3 sm:grid-cols-2">
                {primarySkills.map((skill) => <Skill key={skill.id} skill={skill} primary />)}
                {primarySkills.length === 0 ? <Empty text="No primary skills listed." /> : null}
              </div>
            </PublicSection>
            <PublicSection title="Additional skills" count={otherSkills.length}>
              <div className="flex flex-wrap gap-2">{otherSkills.map((skill) => <span key={skill.id} className="rounded-md border border-[#34343a] bg-[#0f1011] px-3 py-2 text-sm text-[#d0d6e0]">{skill.name} <span className="ml-1 text-xs capitalize text-[#62666d]">{skill.proficiency}</span></span>)}{otherSkills.length === 0 ? <Empty text="No additional skills listed." /> : null}</div>
            </PublicSection>
            <PublicSection title="Education" count={profile.education.length}>
              <div className="divide-y divide-[#23252a] border-y border-[#23252a]">{profile.education.map((item) => <article key={item.id} className="grid gap-2 py-5 sm:grid-cols-[1fr_auto]"><div><h3 className="font-medium">{item.degreeCourse}</h3><p className="mt-1 text-sm text-[#8a8f98]">{item.institution}{item.fieldOfStudy ? `, ${item.fieldOfStudy}` : ""}</p>{item.description ? <p className="mt-3 text-sm leading-6 text-[#8a8f98]">{item.description}</p> : null}</div><p className="text-sm text-[#62666d]">{item.startYear} to {item.currentlyStudying ? "present" : item.endYear}</p></article>)}{profile.education.length === 0 ? <div className="py-5"><Empty text="No education listed." /></div> : null}</div>
            </PublicSection>
          </div>

          <aside className="space-y-8">
            <PublicSection title="Interested in">
              <div className="flex flex-wrap gap-2">{profile.interests.map((item) => <Tag key={item}>{LABELS[item] || item}</Tag>)}{profile.interests.length === 0 ? <Empty text="No interests listed." /> : null}</div>
            </PublicSection>
            <PublicSection title="Preferred roles">
              <div className="flex flex-wrap gap-2">{profile.preferredRoles.map((item) => <Tag key={item}>{LABELS[item] || item}</Tag>)}{profile.preferredRoles.length === 0 ? <Empty text="No collaboration roles listed." /> : null}</div>
            </PublicSection>
            <div className="rounded-xl border border-[#23252a] bg-[#0f1011] p-5 text-sm leading-6 text-[#8a8f98]"><BookOpen className="mb-3 h-4 w-4 text-[#828fff]" aria-hidden="true" />Skills and proficiency are self-reported by the profile owner.</div>
          </aside>
        </div>
      </main>
    </div>
  );
};

const Meta = ({ icon: Icon, label, value }) => <div className="flex gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#62666d]" aria-hidden="true" /><div><dt className="text-xs text-[#62666d]">{label}</dt><dd className="mt-0.5 text-[#d0d6e0]">{value}</dd></div></div>;
const SocialLink = ({ href, label, icon: Icon }) => <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="profile-icon-button"><Icon className="h-4 w-4" aria-hidden="true" /></a>;
const PublicSection = ({ title, count, children }) => <section><div className="mb-4 flex items-baseline justify-between gap-3"><h2 className="text-lg font-medium tracking-[-0.02em]">{title}</h2>{count !== undefined ? <span className="font-mono text-xs text-[#62666d]">{count}</span> : null}</div>{children}</section>;
const Skill = ({ skill }) => <div className="rounded-xl border border-[#34343a] bg-[#0f1011] p-4"><p className="font-medium text-[#f7f8f8]">{skill.name}</p><p className="mt-2 text-xs capitalize text-[#8a8f98]">{skill.category} / {skill.proficiency}</p></div>;
const Tag = ({ children }) => <span className="rounded-md border border-[#34343a] bg-[#141516] px-2.5 py-1.5 text-sm text-[#d0d6e0]">{children}</span>;
const Empty = ({ text }) => <p className="text-sm text-[#62666d]">{text}</p>;

export default PublicProfile;
