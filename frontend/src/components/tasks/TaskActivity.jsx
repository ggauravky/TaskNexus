import TaskCollaborationPanel from "../common/TaskCollaborationPanel";

const ACTIVITY_SECTIONS = Object.freeze(["activity"]);

const TaskActivity = ({ task }) => (
  <section className="rounded-xl border border-[#23252a] bg-[#0f1011] p-4 sm:p-5">
    <TaskCollaborationPanel task={task} sections={ACTIVITY_SECTIONS} title="Recorded task activity" />
  </section>
);

export default TaskActivity;
