import { ArrowUpRight, CalendarDays, CheckCircle2, LockKeyhole, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, progressPercent, projectPath, PROJECT_STATUS_LABELS } from "../../utils/projects";

const ProjectCard = ({ project }) => {
  const progress = progressPercent(project.task_summary);
  return (
    <article className="project-card group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-[#62666d]">{project.team?.name}</p>
          <h3 className="mt-1 truncate text-base font-medium text-[#f7f8f8]">{project.name}</h3>
        </div>
        <span className="project-status"><span className={`project-status-dot is-${project.status}`} />{PROJECT_STATUS_LABELS[project.status]}</span>
      </div>
      <p className="mt-3 min-h-10 text-sm leading-5 text-[#8a8f98]">{project.tagline || "A focused Team project."}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {(project.skills || []).slice(0, 4).map((skill) => <span key={skill.id} className="team-chip">{skill.name}</span>)}
      </div>
      <div className="mt-5" aria-label={`${project.task_summary?.done || 0} of ${project.task_summary?.total || 0} tasks complete`}>
        <div className="flex items-center justify-between text-xs text-[#8a8f98]"><span>Task progress</span><span>{project.task_summary?.done || 0}/{project.task_summary?.total || 0}</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#23252a]"><span className="block h-full rounded-full bg-[#5e6ad2]" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#23252a] pt-4 text-xs text-[#8a8f98]">
        <div className="flex flex-wrap gap-3"><span className="flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" />{project.participant_count}</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(project.target_date)}</span>{project.effective_visibility === "team" ? <span className="flex items-center gap-1"><LockKeyhole className="h-3.5 w-3.5" />Team</span> : null}{project.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" aria-label="Completed" /> : null}</div>
        <Link to={projectPath(project)} className="inline-flex items-center gap-1 font-medium text-[#d0d6e0] group-hover:text-white">Open <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </article>
  );
};

export default ProjectCard;
