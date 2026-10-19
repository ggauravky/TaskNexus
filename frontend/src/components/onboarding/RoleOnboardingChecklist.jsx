import { ArrowUpRight, CheckCircle2, Circle } from "lucide-react";
import { Link } from "react-router-dom";
import { onboardingView } from "../../utils/onboarding";

const ChecklistItem = ({ item }) => (
  <li className="flex flex-col gap-3 rounded-lg border border-[#23252a] bg-[#141516] p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 gap-3">
      {item.complete
        ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
        : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#62666d]" aria-hidden="true" />}
      <div>
        <p className="text-sm font-medium text-[#f7f8f8]">{item.label}</p>
        <p className="mt-1 text-xs leading-5 text-[#8a8f98]">{item.description}</p>
        <span className="sr-only">{item.complete ? "Complete" : "Not complete"}</span>
      </div>
    </div>
    {!item.complete && item.action ? (
      <Link
        to={item.action.targetPath}
        style={{ minHeight: 44 }}
        className="team-button-secondary shrink-0 self-start sm:self-center"
      >
        {item.action.label}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    ) : null}
  </li>
);

const RoleOnboardingChecklist = ({ onboarding }) => {
  const view = onboardingView(onboarding);
  if (!view) return null;
  const headingId = `${view.role}-onboarding-heading`;

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-[#34343a] bg-[#0f1011] p-4 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#828fff]">Getting started</p>
          <h2 id={headingId} className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#f7f8f8]">
            {view.role === "client" ? "Set up your client workflow" : "Build your freelancer foundation"}
          </h2>
        </div>
        <p aria-live="polite" className="text-sm text-[#b7bdf8]">
          {view.completedCount} of {view.totalCount} required steps complete
        </p>
      </div>
      <ol className="mt-4 grid gap-2" aria-label="Required onboarding steps">
        {view.items.map((item) => <ChecklistItem key={item.id} item={item} />)}
      </ol>
      {view.optionalItems.length ? (
        <div className="mt-4 border-t border-[#23252a] pt-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#62666d]">Optional growth</p>
          <ul className="mt-2 grid gap-2" aria-label="Optional growth steps">
            {view.optionalItems.map((item) => <ChecklistItem key={item.id} item={item} />)}
          </ul>
        </div>
      ) : null}
    </section>
  );
};

export default RoleOnboardingChecklist;
