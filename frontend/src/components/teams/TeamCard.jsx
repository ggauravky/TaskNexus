import { ArrowUpRight, LockKeyhole, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { initials, interestLabel } from "../../utils/teams";

const relationshipText = {
  member: "Member", invited: "Invitation pending", pending_request: "Request pending", none: null,
};

const TeamCard = ({ team }) => (
  <article className="team-card group">
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {team.avatar_url ? <img src={team.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="team-avatar">{initials(team.name)}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-base font-medium text-[#f7f8f8]">{team.name}</h3>
          <p className="truncate text-xs text-[#62666d]">/{team.slug}</p>
        </div>
      </div>
      {team.visibility === "private" ? <LockKeyhole className="h-4 w-4 text-[#62666d]" aria-label="Private team" /> : null}
    </div>
    <p className="mt-4 min-h-12 text-sm leading-6 text-[#8a8f98]">{team.tagline || "A TaskNexus collaboration team."}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      {(team.primary_interests || []).slice(0, 3).map((interest) => <span key={interest} className="team-chip">{interestLabel(interest)}</span>)}
    </div>
    <div className="mt-5 flex items-center justify-between border-t border-[#23252a] pt-4">
      <span className="flex items-center gap-1.5 text-xs text-[#8a8f98]"><UsersRound className="h-3.5 w-3.5" /> {team.member_count} {team.member_count === 1 ? "member" : "members"}</span>
      <div className="flex items-center gap-3">
        {relationshipText[team.viewer_relationship?.kind] ? <span className="text-xs text-[#b7bdf8]">{relationshipText[team.viewer_relationship.kind]}</span> : null}
        <Link to={`/teams/${team.slug}`} className="inline-flex items-center gap-1 text-sm font-medium text-[#d0d6e0] group-hover:text-white">View <ArrowUpRight className="h-4 w-4" /></Link>
      </div>
    </div>
  </article>
);

export default TeamCard;
