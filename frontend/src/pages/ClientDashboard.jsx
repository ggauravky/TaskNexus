import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Calendar,
  Eye,
  RefreshCw,
  List,
  Search,
  Star,
  Filter,
  Target,
  Sparkles,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import CreateTaskModal from '../components/client/CreateTaskModal';
import TaskDetailsModal from '../components/client/TaskDetailsModal';
import DashboardSettings from '../components/common/DashboardSettings';
import { usePreferences } from '../hooks/usePreferences';
import { TASK_STATUS } from '../utils/constants';

const PINNED_STORAGE_KEY = 'tasknexus_client_pinned_tasks_v1';

const TASK_TEMPLATES = [
  {
    id: 'landing-refresh',
    title: 'Landing page refresh',
    description:
      'Redesign the homepage for better conversion, clearer value proposition, and mobile-first responsiveness.',
    category: 'design',
    budget: 900,
    experienceLevel: 'intermediate',
    skillsRequired: ['UI Design', 'Figma', 'Responsive Design'],
  },
  {
    id: 'api-integration',
    title: 'API integration and QA',
    description:
      'Integrate third-party APIs into an existing app and deliver tested flows with edge-case coverage.',
    category: 'web_development',
    budget: 1400,
    experienceLevel: 'expert',
    skillsRequired: ['React', 'Node.js', 'API Integration', 'Testing'],
  },
  {
    id: 'content-campaign',
    title: 'Content campaign package',
    description:
      'Create a multi-channel content package with blog drafts, social copy, and campaign messaging.',
    category: 'writing',
    budget: 700,
    experienceLevel: 'intermediate',
    skillsRequired: ['Copywriting', 'Content Strategy', 'SEO'],
  },
];

const TASK_FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending_review', label: 'Pending review' },
  { id: 'completed', label: 'Completed' },
];

const TASK_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'budget_high', label: 'Highest budget' },
  { id: 'budget_low', label: 'Lowest budget' },
  { id: 'deadline_soon', label: 'Nearest deadline' },
];

const getTaskId = (task) => task?.id || task?._id || '';
const getTaskTitle = (task) => task?.task_details?.title || task?.title || 'Untitled Task';
const getTaskDescription = (task) => task?.task_details?.description || task?.description || 'No description';
const getTaskBudget = (task) => Number(task?.task_details?.budget ?? task?.budget ?? 0);
const getTaskDeadline = (task) => task?.task_details?.deadline || task?.deadline || null;
const getTaskCreatedAt = (task) => task?.created_at || task?.createdAt || null;

const formatDate = (value) => {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No date';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const getDueBadge = (task) => {
  const deadline = getTaskDeadline(task);
  if (!deadline) return { label: 'No deadline', tone: 'muted' };

  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return { label: 'No deadline', tone: 'muted' };

  const now = new Date();
  const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'danger' };
  if (days === 0) return { label: 'Due today', tone: 'warning' };
  if (days <= 3) return { label: `Due in ${days}d`, tone: 'warning' };
  return { label: `Due in ${days}d`, tone: 'ok' };
};

const getSafeStorageArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const csvEscape = (value) => {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const badgeTone = (tone) => {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    muted: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return tones[tone] || tones.muted;
};

/**
 * Major Client Workspace
 */
const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [viewAllTasks, setViewAllTasks] = useState(false);
  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState('all');
  const [taskSort, setTaskSort] = useState('newest');

  const [stats, setStats] = useState({
    totalTasks: 0,
    activeTasks: 0,
    completedTasks: 0,
    pendingReview: 0,
    totalSpent: 0,
    avgCompletionTime: 0,
  });
  const [recentTasks, setRecentTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [pinnedTaskIds, setPinnedTaskIds] = useState([]);

  const { preferences, togglePreference, setPreference, resetPreferences } = usePreferences();

  useEffect(() => {
    setPinnedTaskIds(getSafeStorageArray(PINNED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinnedTaskIds));
  }, [pinnedTaskIds]);

  useEffect(() => {
    setTaskFilter(preferences.defaultTaskFilter || 'all');
  }, [preferences.defaultTaskFilter]);

  useEffect(() => {
    setTaskSort(preferences.defaultTaskSort || 'newest');
  }, [preferences.defaultTaskSort]);

  const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);

      const [dashboardRes, tasksRes] = await Promise.all([
        api.get('/client/dashboard'),
        api.get('/client/tasks?limit=8&sort=-createdAt'),
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data || {});
      }

      if (tasksRes.data.success) {
        setRecentTasks(tasksRes.data.data || []);
      }

      setError(null);
    } catch (fetchError) {
      const message = fetchError?.message || 'Failed to load dashboard data';
      setError(message);
      if (!silent) {
        toast.error('Failed to load dashboard data. Please try refreshing.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchAllTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/client/tasks?limit=200&sort=-createdAt');

      if (response.data.success) {
        setAllTasks(response.data.data || []);
        setViewAllTasks(true);
      }
    } catch (fetchError) {
      toast.error(fetchError?.message || 'Failed to load all tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!preferences.autoRefresh) {
      return undefined;
    }

    const seconds = Math.max(30, Number(preferences.autoRefreshSeconds || 120));
    const timer = window.setInterval(() => {
      fetchDashboardData({ silent: true });
    }, seconds * 1000);

    return () => window.clearInterval(timer);
  }, [preferences.autoRefresh, preferences.autoRefreshSeconds, fetchDashboardData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData({ silent: false });
    if (viewAllTasks) {
      await fetchAllTasks();
    }
    setRefreshing(false);
    toast.success('Client workspace refreshed');
  };

  const handleTaskCreated = async () => {
    await fetchDashboardData();
    if (viewAllTasks) {
      await fetchAllTasks();
    }
    toast.success('Task created successfully');
  };

  const handleToggleAllTasks = async () => {
    if (viewAllTasks) {
      setViewAllTasks(false);
      return;
    }

    await fetchAllTasks();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const togglePinTask = (taskId) => {
    if (!preferences.quickActions.pinning || !taskId) {
      return;
    }

    setPinnedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [taskId, ...prev],
    );
  };

  const sourceTasks = viewAllTasks ? allTasks : recentTasks;

  const filteredTasks = useMemo(() => {
    const filteredByStatus = sourceTasks.filter((task) => {
      if (taskFilter === 'all') return true;

      const status = task?.status;
      if (!status) return false;

      if (taskFilter === 'completed') {
        return status === TASK_STATUS.COMPLETED;
      }

      if (taskFilter === 'pending_review') {
        return [
          TASK_STATUS.SUBMITTED,
          TASK_STATUS.UNDER_REVIEW,
          TASK_STATUS.SUBMITTED_WORK,
          TASK_STATUS.QA_REVIEW,
          TASK_STATUS.REVISION_REQUESTED,
          TASK_STATUS.CLIENT_REVISION,
        ].includes(status);
      }

      if (taskFilter === 'active') {
        return [
          TASK_STATUS.ASSIGNED,
          TASK_STATUS.IN_PROGRESS,
          TASK_STATUS.SUBMITTED,
          TASK_STATUS.SUBMITTED_WORK,
          TASK_STATUS.DELIVERED,
        ].includes(status);
      }

      return true;
    });

    const filteredBySearch = filteredByStatus.filter((task) => {
      if (!taskSearch.trim()) return true;

      const query = taskSearch.toLowerCase();
      const title = getTaskTitle(task).toLowerCase();
      const id = String(getTaskId(task)).toLowerCase();
      const description = getTaskDescription(task).toLowerCase();

      return title.includes(query) || id.includes(query) || description.includes(query);
    });

    const sorted = [...filteredBySearch].sort((left, right) => {
      if (taskSort === 'newest') {
        return new Date(getTaskCreatedAt(right) || 0) - new Date(getTaskCreatedAt(left) || 0);
      }

      if (taskSort === 'oldest') {
        return new Date(getTaskCreatedAt(left) || 0) - new Date(getTaskCreatedAt(right) || 0);
      }

      if (taskSort === 'budget_high') {
        return getTaskBudget(right) - getTaskBudget(left);
      }

      if (taskSort === 'budget_low') {
        return getTaskBudget(left) - getTaskBudget(right);
      }

      if (taskSort === 'deadline_soon') {
        const leftDeadline = new Date(getTaskDeadline(left) || '9999-12-31').getTime();
        const rightDeadline = new Date(getTaskDeadline(right) || '9999-12-31').getTime();
        return leftDeadline - rightDeadline;
      }

      return 0;
    });

    if (!preferences.quickActions.pinning || pinnedTaskIds.length === 0) {
      return sorted;
    }

    return sorted.sort((left, right) => {
      const leftPinned = pinnedTaskIds.includes(getTaskId(left));
      const rightPinned = pinnedTaskIds.includes(getTaskId(right));
      if (leftPinned === rightPinned) return 0;
      return leftPinned ? -1 : 1;
    });
  }, [sourceTasks, taskFilter, taskSearch, taskSort, preferences.quickActions.pinning, pinnedTaskIds]);

  const boardColumns = useMemo(
    () => [
      {
        id: 'planning',
        title: 'Planning',
        matcher: (status) => [TASK_STATUS.SUBMITTED, TASK_STATUS.UNDER_REVIEW].includes(status),
      },
      {
        id: 'execution',
        title: 'Execution',
        matcher: (status) =>
          [
            TASK_STATUS.ASSIGNED,
            TASK_STATUS.IN_PROGRESS,
            TASK_STATUS.SUBMITTED_WORK,
            TASK_STATUS.QA_REVIEW,
            TASK_STATUS.REVISION_REQUESTED,
            TASK_STATUS.CLIENT_REVISION,
            TASK_STATUS.DELIVERED,
          ].includes(status),
      },
      {
        id: 'done',
        title: 'Done',
        matcher: (status) => status === TASK_STATUS.COMPLETED,
      },
      {
        id: 'other',
        title: 'Other',
        matcher: (status) => [TASK_STATUS.CANCELLED, TASK_STATUS.DISPUTED].includes(status),
      },
    ],
    [],
  );

  const groupedBoard = useMemo(
    () =>
      boardColumns
        .map((column) => ({
          ...column,
          tasks: filteredTasks.filter((task) => column.matcher(task?.status)),
        }))
        .filter((column) => column.tasks.length > 0),
    [boardColumns, filteredTasks],
  );

  const deadlineSource = allTasks.length > 0 ? allTasks : recentTasks;

  const upcomingDeadlines = useMemo(() => {
    return deadlineSource
      .filter((task) => {
        const status = task?.status;
        if ([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].includes(status)) {
          return false;
        }

        const deadline = getTaskDeadline(task);
        if (!deadline) return false;
        return !Number.isNaN(new Date(deadline).getTime());
      })
      .sort((left, right) => new Date(getTaskDeadline(left)) - new Date(getTaskDeadline(right)))
      .slice(0, 6);
  }, [deadlineSource]);

  const advancedInsights = useMemo(() => {
    const completionRate = stats.totalTasks
      ? Math.round((Number(stats.completedTasks || 0) / Number(stats.totalTasks || 1)) * 100)
      : 0;

    const overdueCount = (allTasks.length > 0 ? allTasks : recentTasks).filter((task) => {
      const due = getTaskDeadline(task);
      if (!due) return false;
      const dueTime = new Date(due).getTime();
      if (Number.isNaN(dueTime)) return false;
      const status = task?.status;
      if ([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].includes(status)) return false;
      return dueTime < Date.now();
    }).length;

    const budgetPool = (allTasks.length > 0 ? allTasks : recentTasks).map((task) => getTaskBudget(task));
    const averageBudget =
      budgetPool.length > 0
        ? Math.round(budgetPool.reduce((sum, amount) => sum + amount, 0) / budgetPool.length)
        : 0;

    return {
      completionRate,
      overdueCount,
      averageBudget,
      highBudgetCount: budgetPool.filter((amount) => amount >= 1000).length,
    };
  }, [stats, allTasks, recentTasks]);

  const exportTasksToCsv = () => {
    if (filteredTasks.length === 0) {
      toast.error('No tasks to export');
      return;
    }

    const header = ['Task ID', 'Title', 'Status', 'Budget', 'Deadline', 'Created'];
    const rows = filteredTasks.map((task) => [
      getTaskId(task),
      getTaskTitle(task),
      task?.status || '',
      getTaskBudget(task),
      formatDate(getTaskDeadline(task)),
      formatDate(getTaskCreatedAt(task)),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasknexus-client-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success('Task CSV exported');
  };

  const taskLayout = preferences.taskLayout || 'list';

  if (loading) {
    return <Loading fullScreen={true} text="Loading client workspace..." />;
  }

  if (error && !stats.totalTasks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4">
        <div className="text-center max-w-lg bg-white/90 border border-slate-100 rounded-3xl p-8 shadow-xl">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Unable to load workspace</h2>
          <p className="text-slate-600 mb-5">{error}</p>
          <button onClick={handleRefresh} className="btn btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <header className="backdrop-blur bg-white/80 shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">TN</div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">TaskNexus</h1>
                <p className="text-xs sm:text-sm text-slate-500">Client Workspace</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="btn-sm btn-secondary flex items-center rounded-full px-4"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => navigate('/client/profile')}
                className="btn-sm btn-secondary rounded-full px-4"
              >
                Profile
              </button>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">
                  {user?.profile?.firstName} {user?.profile?.lastName}
                </p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary flex items-center rounded-full">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!preferences.focusMode && (
          <section className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-lg bg-gradient-to-r from-primary-500 via-blue-500 to-cyan-500 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_78%_0%,rgba(255,255,255,0.18),transparent_30%)]" />
            <div className="relative p-8">
              <h2 className="text-3xl font-bold mb-2">
                Welcome back, {user?.profile?.firstName || 'Client'}
              </h2>
              <p className="text-white/90">
                Run your delivery pipeline with templates, board views, automation, and priority tracking.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <HeroBadge>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {stats.completedTasks || 0} completed
                </HeroBadge>
                <HeroBadge>
                  <Clock className="w-4 h-4 mr-1" />
                  {stats.activeTasks || 0} active
                </HeroBadge>
                <HeroBadge>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Layout: {taskLayout}
                </HeroBadge>
              </div>
            </div>
          </section>
        )}

        <section className="flex flex-wrap gap-3 items-start">
          <button
            onClick={() => {
              setSelectedTemplate(null);
              setShowCreateModal(true);
            }}
            className="btn btn-primary flex items-center rounded-full px-5"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Task
          </button>
          <button
            onClick={handleToggleAllTasks}
            className="btn btn-secondary flex items-center rounded-full px-5"
          >
            <List className="w-5 h-5 mr-2" />
            {viewAllTasks ? 'Show Recent Tasks' : 'View All Tasks'}
          </button>
          {preferences.quickActions.export && (
            <button onClick={exportTasksToCsv} className="btn btn-secondary flex items-center rounded-full px-5">
              <FileText className="w-5 h-5 mr-2" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => setPreference('taskLayout', taskLayout === 'list' ? 'grid' : taskLayout === 'grid' ? 'board' : 'list')}
            className="btn btn-ghost rounded-full px-5"
          >
            Switch Layout
          </button>
        </section>

        {preferences.quickActions.templates && (
          <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm uppercase tracking-wide font-semibold text-slate-500 flex items-center gap-2">
                <Target className="w-4 h-4 text-primary-600" />
                Task Templates
              </h3>
              <p className="text-xs text-slate-500">One click prefill for recurring work.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TASK_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => {
                    setSelectedTemplate(template);
                    setShowCreateModal(true);
                  }}
                  hideFinancials={preferences.hideFinancials}
                />
              ))}
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          <StatCard
            title="Total Tasks"
            value={stats.totalTasks || 0}
            icon={<FileText className="w-8 h-8 text-primary-600" />}
            color="bg-primary-50"
          />
          <StatCard
            title="Active"
            value={stats.activeTasks || 0}
            icon={<Clock className="w-8 h-8 text-amber-600" />}
            color="bg-amber-50"
          />
          <StatCard
            title="Completed"
            value={stats.completedTasks || 0}
            icon={<CheckCircle className="w-8 h-8 text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatCard
            title="Pending Review"
            value={stats.pendingReview || 0}
            icon={<AlertCircle className="w-8 h-8 text-orange-600" />}
            color="bg-orange-50"
          />
          <StatCard
            title="Total Spent"
            value={preferences.hideFinancials ? 'Hidden' : formatCurrency(stats.totalSpent || 0)}
            icon={<DollarSign className="w-8 h-8 text-violet-600" />}
            color="bg-violet-50"
          />
          <StatCard
            title="Avg Completion"
            value={`${stats.avgCompletionTime || 0}d`}
            icon={<TrendingUp className="w-8 h-8 text-sky-600" />}
            color="bg-sky-50"
          />
        </section>

        {preferences.showAdvancedStats && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <InsightCard title="Completion Rate" value={`${advancedInsights.completionRate}%`} subtitle="Closed vs total" />
            <InsightCard title="Overdue Tasks" value={advancedInsights.overdueCount} subtitle="Need immediate action" />
            <InsightCard
              title="Avg Budget"
              value={preferences.hideFinancials ? 'Hidden' : formatCurrency(advancedInsights.averageBudget)}
              subtitle="Across loaded tasks"
            />
            <InsightCard title="High Budget Tasks" value={advancedInsights.highBudgetCount} subtitle="At or above $1,000" />
          </section>
        )}

        {preferences.showDeadlineRail && upcomingDeadlines.length > 0 && (
          <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm uppercase tracking-wide font-semibold text-slate-500 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                Upcoming Deadlines
              </h3>
              <p className="text-xs text-slate-500">Closest due dates across your pipeline.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {upcomingDeadlines.map((task) => {
                const dueBadge = getDueBadge(task);
                return (
                  <button
                    key={getTaskId(task)}
                    type="button"
                    onClick={() => {
                      setSelectedTask(task);
                      setShowDetailsModal(true);
                    }}
                    className="text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-primary-200 hover:shadow-sm transition"
                  >
                    <p className="font-semibold text-slate-900 text-sm line-clamp-1">{getTaskTitle(task)}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(getTaskDeadline(task))}</p>
                    <span className={`mt-2 inline-flex px-2 py-1 rounded-full text-[11px] font-semibold ${badgeTone(dueBadge.tone)}`}>
                      {dueBadge.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm p-5">
          <DashboardSettings
            preferences={preferences}
            togglePreference={togglePreference}
            setPreference={setPreference}
            resetPreferences={resetPreferences}
            title="Client Workspace Settings"
          />
        </section>

        <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {viewAllTasks ? `All Tasks (${sourceTasks.length})` : `Recent Tasks (${sourceTasks.length})`}
              </h3>
              <p className="text-xs text-slate-500">Showing {filteredTasks.length} task(s) after filters and sort.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['list', 'grid', 'board'].map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => setPreference('taskLayout', layout)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                    taskLayout === layout
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary-200'
                  }`}
                >
                  {layout}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 border-b border-slate-100 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                  placeholder="Search by title, description, or task ID"
                  className="input pl-9 py-2"
                />
              </div>
              <label className="block">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  Filter
                </p>
                <select
                  value={taskFilter}
                  onChange={(event) => setTaskFilter(event.target.value)}
                  className="input py-2"
                >
                  {TASK_FILTER_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Sort</p>
                <select
                  value={taskSort}
                  onChange={(event) => setTaskSort(event.target.value)}
                  className="input py-2"
                >
                  {TASK_SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {TASK_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTaskFilter(option.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                    taskFilter === option.id
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No tasks match your current view"
                description="Adjust filter/sort criteria or create a new task."
                action={
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowCreateModal(true);
                    }}
                    className="btn btn-primary"
                  >
                    Create task
                  </button>
                }
              />
            ) : taskLayout === 'board' ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                {groupedBoard.map((column) => (
                  <div key={column.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-700">{column.title}</h4>
                      <span className="text-xs font-semibold text-slate-500">{column.tasks.length}</span>
                    </div>
                    <div className="space-y-2">
                      {column.tasks.map((task) => (
                        <BoardCard
                          key={getTaskId(task)}
                          task={task}
                          onClick={() => {
                            setSelectedTask(task);
                            setShowDetailsModal(true);
                          }}
                          isPinned={pinnedTaskIds.includes(getTaskId(task))}
                          onTogglePin={() => togglePinTask(getTaskId(task))}
                          canPin={preferences.quickActions.pinning}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={taskLayout === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : 'space-y-4'}>
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={getTaskId(task)}
                    task={task}
                    onViewDetails={() => {
                      setSelectedTask(task);
                      setShowDetailsModal(true);
                    }}
                    onTogglePin={() => togglePinTask(getTaskId(task))}
                    isPinned={pinnedTaskIds.includes(getTaskId(task))}
                    canPin={preferences.quickActions.pinning}
                    hideFinancials={preferences.hideFinancials}
                    preferences={preferences}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedTemplate(null);
        }}
        onTaskCreated={handleTaskCreated}
        initialData={selectedTemplate}
      />

      <TaskDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        task={selectedTask}
      />
    </div>
  );
};

const TaskCard = ({
  task,
  onViewDetails,
  onTogglePin,
  isPinned,
  canPin,
  hideFinancials,
  preferences,
}) => {
  const compact = preferences?.compactCards || preferences?.taskDensity === 'compact';
  const progress = task?.metrics?.progress ?? null;
  const dueBadge = getDueBadge(task);

  return (
    <div
      className={`border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} hover:shadow-xl transition-all duration-200 hover:border-primary-200 bg-white/80 backdrop-blur-sm`}
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 mb-1 text-lg line-clamp-1">{getTaskTitle(task)}</h4>
          <p className="text-sm text-slate-600 line-clamp-2">{getTaskDescription(task)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={task?.status} />
          {canPin && (
            <button
              type="button"
              onClick={onTogglePin}
              className={`text-xs font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-full border ${
                isPinned
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-200'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
              {isPinned ? 'Pinned' : 'Pin'}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-4 text-sm text-slate-600 mb-4 pb-4 border-b border-slate-100">
        <span className="flex items-center font-medium">
          <DollarSign className="w-4 h-4 mr-1 text-emerald-600" />
          {hideFinancials ? 'Hidden' : formatCurrency(getTaskBudget(task))}
        </span>
        <span className="flex items-center">
          <Calendar className="w-4 h-4 mr-1 text-blue-600" />
          {formatDate(getTaskDeadline(task))}
        </span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeTone(dueBadge.tone)}`}>
          {dueBadge.label}
        </span>
        {progress !== null && (
          <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded-full">
            {progress}% complete
          </span>
        )}
      </div>

      {progress !== null && preferences?.showProgressBars && (
        <div className="mb-4">
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-cyan-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Created {formatDate(getTaskCreatedAt(task))}</p>
        <button onClick={onViewDetails} className="btn-sm btn-primary flex items-center rounded-full px-4">
          <Eye className="w-4 h-4 mr-1" />
          View
        </button>
      </div>
    </div>
  );
};

const BoardCard = ({ task, onClick, isPinned, onTogglePin, canPin }) => {
  const dueBadge = getDueBadge(task);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onClick} className="text-left min-w-0">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{getTaskTitle(task)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatDate(getTaskDeadline(task))}</p>
        </button>
        {canPin && (
          <button
            type="button"
            onClick={onTogglePin}
            className="text-slate-400 hover:text-amber-500 transition"
            aria-label="Pin task"
          >
            <Star className={`w-4 h-4 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusBadge status={task?.status} />
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${badgeTone(dueBadge.tone)}`}>
          {dueBadge.label}
        </span>
      </div>
    </div>
  );
};

const TemplateCard = ({ template, onUse, hideFinancials }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 hover:border-primary-200 hover:shadow-sm transition">
    <p className="text-sm font-semibold text-slate-900 mb-1">{template.title}</p>
    <p className="text-xs text-slate-600 line-clamp-3">{template.description}</p>
    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
      <span className="px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
        {template.category.replace(/_/g, ' ')}
      </span>
      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        {hideFinancials ? 'Budget hidden' : formatCurrency(template.budget)}
      </span>
    </div>
    <button onClick={onUse} className="btn-sm btn-primary mt-4 w-full">
      Use template
    </button>
  </div>
);

const InsightCard = ({ title, value, subtitle }) => (
  <div className="rounded-xl border border-slate-100 bg-white/90 p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">{title}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
  </div>
);

const HeroBadge = ({ children }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
    {children}
  </span>
);

export default ClientDashboard;
