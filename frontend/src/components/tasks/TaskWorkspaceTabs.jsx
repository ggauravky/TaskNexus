import { useRef } from "react";

const TaskWorkspaceTabs = ({ tabs, activeTab, onChange }) => {
  const refs = useRef([]);
  const activateFromKeyboard = (event, index) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    onChange(tabs[nextIndex].id);
    refs.current[nextIndex]?.focus();
  };

  return (
    <div className="overflow-x-auto border-b border-[#23252a]" aria-label="Task workspace sections">
      <div role="tablist" className="flex min-w-max gap-1 px-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { refs.current[index] = node; }}
            type="button"
            role="tab"
            id={`task-workspace-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`task-workspace-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => activateFromKeyboard(event, index)}
            className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4 ${activeTab === tab.id ? "border-[#828fff] text-[#f7f8f8]" : "border-transparent text-[#8a8f98] hover:text-[#d0d6e0]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TaskWorkspaceTabs;
