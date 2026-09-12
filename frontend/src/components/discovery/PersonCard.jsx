import { Check, ExternalLink, MapPin, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { AVAILABILITY_LABELS, COMMITMENT_LABELS, labelFor } from "../../utils/discovery";

const PersonCard = ({ person, onCollaborate, onInvite }) => (
  <article className="team-card flex min-w-0 flex-col">
    <div className="flex items-start gap-3">
      {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="team-avatar rounded-xl">{person.display_name.slice(0, 2).toUpperCase()}</span>}
      <div className="min-w-0 flex-1"><h2 className="truncate font-medium">{person.display_name}</h2><p className="truncate text-xs text-[#828fff]">@{person.username}</p><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#8a8f98]">{person.headline || "TaskNexus collaborator"}</p></div>
      <span className="team-chip shrink-0">{AVAILABILITY_LABELS[person.availability]}</span>
    </div>
    {person.location ? <p className="mt-4 flex items-center gap-1.5 text-xs text-[#62666d]"><MapPin className="h-3.5 w-3.5" /> {person.location}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">{person.skills.slice(0, 6).map((skill) => <span key={skill.id} className={`team-chip ${person.match_context.matched_skills.some((item) => item.id === skill.id) ? "border-[#5e6ad2] text-[#d0d6e0]" : ""}`}>{skill.name}</span>)}</div>
    <div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#23252a] py-4 text-center"><Fact value={person.published_project_count} label="projects" /><Fact value={person.evidence_summary.internal_task_contributions} label="task proofs" /><Fact value={person.evidence_summary.verified_github_pull_requests} label="verified PRs" /></div>
    {person.hackathon_context ? <div className="mt-4 rounded-lg border border-[#34343a] bg-[#141516] p-3 text-xs leading-5 text-[#8a8f98]"><p className="font-medium text-[#d0d6e0]">Hackathon availability</p><p className="mt-1">{person.hackathon_context.preferred_roles.map(labelFor).join(" · ") || "Flexible role"} · {COMMITMENT_LABELS[person.hackathon_context.commitment]}</p>{person.hackathon_context.message ? <p className="mt-2">{person.hackathon_context.message}</p> : null}</div> : null}
    {person.match_context.matched_skills.length || person.match_context.matched_roles.length || person.match_context.matched_interests.length ? <div className="mt-4 rounded-lg border border-[#23252a] bg-[#141516] p-3"><p className="text-xs font-medium text-[#d0d6e0]">Matches your filters</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8a8f98]">{person.match_context.matched_skills.map((skill) => <span key={skill.id}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{skill.name}</span>)}{person.match_context.matched_roles.map((role) => <span key={role}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{labelFor(role)}</span>)}{person.match_context.matched_interests.map((interest) => <span key={interest}><Check className="mr-1 inline h-3 w-3 text-[#828fff]" />{labelFor(interest)}</span>)}</div></div> : <p className="mt-4 text-xs text-[#62666d]">Ordered by availability and recent profile update.</p>}
    <div className="mt-auto flex flex-wrap gap-2 pt-5"><Link to={`/u/${person.username}`} className="team-button-secondary flex-1">View profile <ExternalLink className="h-4 w-4" /></Link><button onClick={() => onCollaborate(person)} className="team-button-primary flex-1"><Send className="h-4 w-4" /> Collaborate</button>{onInvite ? <button onClick={() => onInvite(person)} className="team-button-secondary w-full"><Send className="h-4 w-4" /> Invite to Team</button> : null}</div>
  </article>
);

const Fact = ({ value, label }) => <div><strong className="block text-lg font-medium">{value}</strong><span className="text-[11px] text-[#62666d]">{label}</span></div>;

export default PersonCard;
