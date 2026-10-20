import { ExternalLink, FolderCheck, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { evidenceTypeLabel, proofCountLabel, safeProofTarget, verificationLabel } from "../../utils/proof";
import { formatDate } from "../../utils/opportunities";

const SkillProofConnections = ({ connections = [] }) => (
  <section aria-labelledby="skill-proof-connections-heading">
    <div className="mb-4">
      <p className="team-eyebrow">Factual connections</p>
      <h2 id="skill-proof-connections-heading" className="mt-2 text-lg font-medium tracking-[-0.02em]">Skills connected to published work</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8a8f98]">These links come from canonical skills used on completed public Projects with published, contributor-approved proof.</p>
    </div>
    {connections.length ? <ul className="space-y-4">
      {connections.map((connection) => <li key={connection.skill.id} className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-[#f7f8f8]">{connection.skill.name}</h3>
          <span className="team-chip">{connection.projects.length} Project{connection.projects.length === 1 ? "" : "s"}</span>
        </div>
        <ProjectProofList projects={connection.projects} />
      </li>)}
    </ul> : <p className="rounded-xl border border-dashed border-[#34343a] p-5 text-sm text-[#62666d]">No factual Project proof is published for these skills yet.</p>}
  </section>
);

export const ProjectProofList = ({ projects = [] }) => <ul className="mt-4 grid gap-3 sm:grid-cols-2">
  {projects.map((project) => <li key={project.id} className="min-w-0 rounded-lg border border-[#34343a] bg-[#141516] p-4">
    <div className="flex min-w-0 items-start gap-3">
      <FolderCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#828fff]" aria-hidden="true" />
      <div className="min-w-0">
        <h4 className="break-words text-sm font-medium text-[#f7f8f8]">{project.name}</h4>
        <p className="mt-1 break-words text-xs text-[#62666d]">{project.team?.name || "Public Team"} · {proofCountLabel(project.evidence_summary)}</p>
      </div>
    </div>
    {project.evidence?.length ? <ul className="mt-4 space-y-2 border-t border-[#23252a] pt-3">
      {project.evidence.map((evidence) => <li key={evidence.id} className="min-w-0 text-xs">
        <div className="flex flex-wrap items-center gap-2"><span className={`evidence-badge is-${evidence.verification}`}><ShieldCheck className="h-3 w-3" aria-hidden="true" />{verificationLabel(evidence.verification)}</span><span className="text-[#62666d]">{evidenceTypeLabel(evidence.type)}</span></div>
        <p className="mt-2 break-words text-[#a8adb6]">{evidence.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[#62666d]"><span>{formatDate(evidence.occurred_at)}</span>{evidence.source_url ? <a href={evidence.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#828fff] hover:text-[#b7bdf8]">Inspect source <ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : null}</div>
      </li>)}
    </ul> : null}
    {safeProofTarget(project.target_path) ? <Link to={safeProofTarget(project.target_path)} className="mt-4 inline-flex min-h-11 items-center text-xs font-medium text-[#b7bdf8] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#828fff]">View Project proof</Link> : null}
  </li>)}
</ul>;

export default SkillProofConnections;
