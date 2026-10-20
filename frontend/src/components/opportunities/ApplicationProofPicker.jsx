import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  evidenceTypeLabel,
  proofSelectionError,
  safeProofTarget,
  toggleProofEvidence,
  toggleProofProject,
  verificationLabel,
} from "../../utils/proof";

const ApplicationProofPicker = ({
  projects = [],
  selectedProjectIds = [],
  selectedEvidenceIds = [],
  onChange,
  disabled = false,
}) => {
  const state = { selectedProjectIds, selectedEvidenceIds };
  const validation = proofSelectionError(projects, state);

  return <fieldset disabled={disabled}>
    <legend className="team-label">Evidence-backed Projects <span className="text-[#62666d]">optional, up to 5</span></legend>
    <p className="mt-2 text-xs leading-5 text-[#8a8f98]">Selecting a Project never selects evidence automatically. Review and choose each item you want to share.</p>
    {projects.length ? <div className="mt-3 space-y-3">{projects.map((project) => {
      const projectSelected = selectedProjectIds.includes(project.id);
      const target = safeProofTarget(project.target_path);
      return <article key={project.id} className="rounded-lg border border-[#23252a] bg-[#111213] p-3">
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            className="mt-1 h-4 w-4"
            type="checkbox"
            checked={projectSelected}
            disabled={disabled || (!projectSelected && selectedProjectIds.length >= 5)}
            onChange={(event) => onChange(toggleProofProject(state, project, event.target.checked))}
          />
          <span className="min-w-0 flex-1">
            <span className="block break-words text-sm font-medium text-[#e8eaed]">{project.name}</span>
            <span className="mt-1 block text-xs leading-5 text-[#8a8f98]">{project.participant_role || "Participant"} · {project.team?.name || "Public Team"} · {project.evidence_count} public-safe evidence item{project.evidence_count === 1 ? "" : "s"}</span>
          </span>
        </label>
        {target ? <Link to={target} className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-[#828fff] hover:text-[#b7bdf8]">View Project <ArrowUpRight className="h-3.5 w-3.5" /></Link> : null}
        {projectSelected ? <div className="mt-3 border-t border-[#23252a] pt-3">
          <p className="text-xs font-medium text-[#d0d6e0]">Choose evidence to share</p>
          <div className="mt-2 space-y-2">{(project.evidence || []).map((item) => {
            const evidenceSelected = selectedEvidenceIds.includes(item.id);
            return <label key={item.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-[#292b30] p-3">
              <input
                className="mt-1 h-4 w-4"
                type="checkbox"
                checked={evidenceSelected}
                disabled={disabled || (!evidenceSelected && selectedEvidenceIds.length >= 12)}
                onChange={(event) => onChange(toggleProofEvidence(state, item, event.target.checked))}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm text-[#d0d6e0]">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-[#62666d]">{evidenceTypeLabel(item.type)} · {verificationLabel(item.verification)}</span>
                {item.source_url ? <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-[#828fff] hover:text-[#b7bdf8]" onClick={(event) => event.stopPropagation()}>Inspect source <ArrowUpRight className="h-3.5 w-3.5" /></a> : null}
              </span>
            </label>;
          })}</div>
        </div> : null}
      </article>;
    })}</div> : <p className="mt-3 text-sm text-[#62666d]">No eligible completed public Projects. You can still apply without selecting one.</p>}
    <p className={`mt-3 text-xs ${validation ? "text-amber-300" : "text-[#62666d]"}`} aria-live="polite">{validation || `${selectedProjectIds.length}/5 Projects and ${selectedEvidenceIds.length}/12 evidence items selected.`}</p>
  </fieldset>;
};

export default ApplicationProofPicker;
