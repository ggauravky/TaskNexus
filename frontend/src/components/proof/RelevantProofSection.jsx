import { ProjectProofList } from "./SkillProofConnections";

const RelevantProofSection = ({ proof }) => {
  const connections = proof?.required_skills || [];
  return <section className="border-b border-[#23252a] py-8" aria-labelledby="relevant-proof-heading">
    <p className="team-eyebrow">Your factual overlap</p>
    <h2 id="relevant-proof-heading" className="mt-2 text-xl font-semibold tracking-[-0.02em]">Relevant proof from your Projects</h2>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8a8f98]">Required skills are connected only when the same canonical skill appears on your profile and an eligible completed Project.</p>
    {connections.length ? <ul className="mt-5 space-y-4">
      {connections.map((connection) => <li key={connection.skill.id} className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{connection.skill.name}</h3><span className="team-chip">Required skill</span></div>
        <ProjectProofList projects={connection.projects} />
      </li>)}
    </ul> : <p className="mt-5 rounded-xl border border-dashed border-[#34343a] p-5 text-sm text-[#62666d]">No factual Project proof currently overlaps this Opportunity’s required skills.</p>}
    <p className="mt-4 text-xs leading-5 text-[#62666d]">{proof?.disclaimer}</p>
  </section>;
};

export default RelevantProofSection;
