import { CalendarDays, CircleDollarSign, Gauge, UserRound } from "lucide-react";
import StatusBadge from "../common/StatusBadge";
import { formatCurrency, formatDate, taskBudget, taskDeadline, taskDescription, taskTitle } from "../../utils/marketplace";

const WORKFLOW_LABELS = Object.freeze({
  reviewedAt: "Marketplace reviewed",
  assignedAt: "Freelancer assigned",
  startedAt: "Work started",
  submittedWorkAt: "Work submitted",
  deliveredAt: "Delivery created",
  completedAt: "Task completed",
  cancelledAt: "Task cancelled",
  unassignedAt: "Returned to marketplace",
});

const Detail = ({ icon: Icon, label, value }) => (
  <div className="min-w-0 bg-[#141516] p-4 sm:p-5">
    <dt className="flex items-center gap-2 text-xs text-[#62666d]"><Icon className="h-4 w-4" />{label}</dt>
    <dd className="mt-2 break-words text-sm font-medium text-[#d0d6e0]">{value}</dd>
  </div>
);

const TaskOverview = ({ workspace }) => {
  const { task, participants, progress } = workspace;
  const details = task.task_details || {};
  const workflowEntries = Object.entries(task.workflow || {})
    .filter(([key, value]) => WORKFLOW_LABELS[key] && value)
    .map(([key, value]) => ({ key, label: WORKFLOW_LABELS[key], value }));
  const skills = Array.isArray(details.skillsRequired) ? details.skillsRequired : [];

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="team-eyebrow">Marketplace task overview</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#f7f8f8] sm:text-2xl">{taskTitle(task)}</h2>
          </div>
          <StatusBadge status={task.status} />
        </div>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#b0b4bc]">{taskDescription(task)}</p>
        {skills.length ? <div className="mt-5 flex flex-wrap gap-2">{skills.map((skill) => <span key={skill} className="team-chip">{skill}</span>)}</div> : null}
      </section>

      <dl className="grid gap-px overflow-hidden rounded-xl border border-[#23252a] bg-[#23252a] sm:grid-cols-2 xl:grid-cols-4">
        <Detail icon={CircleDollarSign} label="Budget" value={formatCurrency(taskBudget(task))} />
        <Detail icon={CalendarDays} label="Deadline" value={formatDate(taskDeadline(task))} />
        <Detail icon={Gauge} label="Experience" value={details.experienceLevel || "Not specified"} />
        <Detail icon={UserRound} label="Category" value={details.type || details.category || "Not specified"} />
      </dl>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
          <h2 className="text-base font-medium text-[#f7f8f8]">People</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Participant label="Client" participant={participants.client} />
            <Participant label="Freelancer" participant={participants.freelancer} fallback="Not assigned" />
          </div>
        </section>

        <section className="rounded-xl border border-[#34343a] bg-[#141516] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-[#62666d]">Current lifecycle state</p>
              <p className="mt-1 text-lg font-semibold capitalize text-[#f7f8f8]">{String(task.status || "unknown").replaceAll("_", " ")}</p>
            </div>
            <span className="text-2xl font-semibold text-[#b7bdf8]">{progress.percentage}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#23252a]" aria-label={`Task progress ${progress.percentage}%`}>
            <div className="h-full bg-[#5e6ad2]" style={{ width: `${Math.min(100, Math.max(0, progress.percentage))}%` }} />
          </div>
          <p className="mt-3 text-xs text-[#8a8f98]">{progress.note || "No progress note has been recorded."}</p>
        </section>
      </div>

      <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
        <h2 className="text-base font-medium text-[#f7f8f8]">Recorded lifecycle</h2>
        {workflowEntries.length ? <ol className="mt-4 space-y-3">{workflowEntries.map((entry) => (
          <li key={entry.key} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#828fff]" aria-hidden="true" />
            <div><p className="text-sm text-[#d0d6e0]">{entry.label}</p><p className="mt-0.5 text-xs text-[#62666d]">{formatDate(entry.value)}</p></div>
          </li>
        ))}</ol> : <p className="mt-3 text-sm text-[#8a8f98]">No lifecycle timestamps have been recorded yet.</p>}
        <p className="mt-4 border-t border-[#23252a] pt-4 text-xs text-[#62666d]">Created {formatDate(task.created_at)}</p>
      </section>
    </div>
  );
};

const Participant = ({ label, participant, fallback = "Unavailable" }) => (
  <div className="rounded-lg border border-[#23252a] bg-[#141516] p-4">
    <p className="text-xs text-[#62666d]">{label}</p>
    <p className="mt-1 truncate text-sm font-medium text-[#f7f8f8]">{participant?.name || fallback}</p>
  </div>
);

export default TaskOverview;
