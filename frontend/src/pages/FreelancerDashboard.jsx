import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Briefcase,
  DollarSign,
  Star,
  Clock,
  CheckCircle,
  RefreshCw,
  Eye,
  Target,
  Search,
  Calendar,
  Award,
  Activity,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import TaskDetailsModal from '../components/freelancer/TaskDetailsModal';
import DashboardSettings from '../components/common/DashboardSettings';
import { usePreferences } from '../hooks/usePreferences';
import useBoardState from '../hooks/useBoardState';
import useRealtimeEvents from '../hooks/useRealtimeEvents';
import { TASK_STATUS } from '../utils/constants';

const FREELANCER_PINNED_STORAGE_KEY = 'tasknexus_freelancer_pinned_tasks_v1';
const LOCAL_PROGRESS_KEY = 'tasknexus_freelancer_progress';

const TASK_SORT_OPTIONS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'budget_high', label: 'Highest budget' },
  { id: 'budget_low', label: 'Lowest budget' },
  { id: 'deadline_soon', label: 'Nearest deadline' },
];

const MY_TASK_FILTER_OPTIONS = [
  { id: 'all', label: 'All statuses' },
  { id: TASK_STATUS.ASSIGNED, label: 'Assigned' },
  { id: TASK_STATUS.IN_PROGRESS, label: 'In progress' },
  { id: TASK_STATUS.SUBMITTED_WORK, label: 'Submitted work' },
  { id: TASK_STATUS.COMPLETED, label: 'Completed' },
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

const getSafeStorageArray = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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

const badgeTone = (tone) => {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    muted: 'bg-slate-100 text-slate-600 border border-slate-200',
  };
  return tones[tone] || tones.muted;
};

const csvEscape = (value) => {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
};

const FreelancerDashboard = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('myTasks');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [stats, setStats] = useState({
    activeTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
    performanceScore: 0,
    rating: 0,
    totalReviews: 0,
    onTimeDeliveryRate: 0,
    totalTasks: 0,
  });

  const [myTasks, setMyTasks] = useState([]);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [taskSort, setTaskSort] = useState('newest');
  const [matchSkills, setMatchSkills] = useState(false);

  const [pinnedTaskIds, setPinnedTaskIds] = useState([]);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);

  const {
    preferences,
    presets,
    activePresetId,
    loadingPreferences,
    savingPreferences,
    syncError,
    togglePreference,
    setPreference,
    resetPreferences,
    applyPreset,
    savePreset,
  } = usePreferences();
  const {
    boardState,
    orderedColumns,
    savingBoard,
    updateBoardState,
    resetBoardState,
    moveTask,
    reorderColumns,
    sortTasksByColumnOrder,
  } = useBoardState({ boardKey: 'freelancer-dashboard', role: 'freelancer' });

  const [draggingTask, setDraggingTask] = useState(null);
  const [draggingColumn, setDraggingColumn] = useState(null);

  useEffect(() => {
    setPinnedTaskIds(getSafeStorageArray(FREELANCER_PINNED_STORAGE_KEY));
  }, []);

  useEffect(() => {
    localStorage.setItem(FREELANCER_PINNED_STORAGE_KEY, JSON.stringify(pinnedTaskIds));
  }, [pinnedTaskIds]);

  useEffect(() => {
    setTaskSort(boardState.sort || preferences.defaultTaskSort || 'newest');
  }, [boardState.sort, preferences.defaultTaskSort]);

  useEffect(() => {
    setFilterStatus(boardState.filter || 'all');
  }, [boardState.filter]);

  const loadProgressCache = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_PROGRESS_KEY)) || {};
    } catch {
      return {};
    }
  }, []);

  const saveProgressCache = useCallback(
    (taskId, metrics) => {
      const cache = loadProgressCache();
      cache[taskId] = metrics;
      localStorage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(cache));
    },
    [loadProgressCache],
  );

  const mergeProgressFromCache = useCallback(
    (tasks) => {
      const cache = loadProgressCache();
      return (tasks || []).map((task) => {
        const id = getTaskId(task);
        if (!id) return task;

        if (task.metrics || !cache[id]) {
          return task;
        }

        return {
          ...task,
          metrics: cache[id],
        };
      });
    },
    [loadProgressCache],
  );

  const fetchDashboardData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);

      const [dashboardRes, myTasksRes, availableRes] = await Promise.all([
        api.get('/freelancer/dashboard'),
        api.get('/freelancer/my-tasks?limit=50'),
        api.get('/freelancer/available-tasks?limit=50'),
      ]);

      if (dashboardRes.data.success) {
        setStats(dashboardRes.data.data || {});
      }

      if (myTasksRes.data.success) {
        setMyTasks(mergeProgressFromCache(myTasksRes.data.data.tasks || []));
      }

      if (availableRes.data.success) {
        setAvailableTasks(mergeProgressFromCache(availableRes.data.data.tasks || []));
      }

      setError(null);
    } catch (fetchError) {
      const message = fetchError?.message || 'Failed to load dashboard';
      setError(message);
      if (!silent) {
        toast.error('Failed to load freelancer workspace. Please refresh.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [mergeProgressFromCache]);

  const fetchEarnings = useCallback(async () => {
    try {
      const response = await api.get('/freelancer/earnings?limit=80');
      if (response.data.success) {
        setEarnings(response.data.data.payments || []);
      }
    } catch (fetchError) {
      toast.error(fetchError?.message || 'Failed to load earnings');
    }
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      const response = await api.get('/freelancer/reviews?limit=80');
      if (response.data.success) {
        setReviews(response.data.data || []);
      }
    } catch (fetchError) {
      toast.error(fetchError?.message || 'Failed to load reviews');
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

  useEffect(() => {
    if (activeTab === 'earnings' && earnings.length === 0) {
      fetchEarnings();
    }
    if (activeTab === 'reviews' && reviews.length === 0) {
      fetchReviews();
    }
  }, [activeTab, earnings.length, reviews.length, fetchEarnings, fetchReviews]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData({ silent: false });
    if (activeTab === 'earnings') await fetchEarnings();
    if (activeTab === 'reviews') await fetchReviews();
    setRefreshing(false);
    toast.success('Freelancer workspace refreshed');
  };

  const handleAcceptTask = async (taskId) => {
    try {
      const response = await api.post(`/freelancer/tasks/${taskId}/accept`);
      if (response.data.success) {
        toast.success('Task accepted successfully');
        await fetchDashboardData();
        setActiveTab('myTasks');
      }
    } catch (acceptError) {
      const message =
        acceptError.response?.data?.error?.message ||
        acceptError.response?.data?.message ||
        'Failed to accept task';
      toast.error(message);
    }
  };

  const handleStartWorking = async (task) => {
    try {
      await api.put(`/freelancer/tasks/${getTaskId(task)}/start`);
      toast.success('Task marked as in progress');
      setShowDetailsModal(false);
      await fetchDashboardData();
    } catch (startError) {
      toast.error(startError.response?.data?.message || 'Could not start task');
    }
  };

  const handleCancelTask = async (task) => {
    try {
      await api.put(`/freelancer/tasks/${getTaskId(task)}/cancel`);
      toast.success('Task returned to available pool');
      setShowDetailsModal(false);
      await fetchDashboardData();
    } catch (cancelError) {
      toast.error(cancelError.response?.data?.message || 'Could not cancel task');
    }
  };

  const handleUpdateProgress = async (taskId, progressPayload) => {
    try {
      await api.put(`/freelancer/tasks/${taskId}/progress`, progressPayload);
      toast.success('Progress updated');
      saveProgressCache(taskId, {
        ...(selectedTask?.metrics || {}),
        ...progressPayload,
        progressUpdatedAt: new Date().toISOString(),
      });
      await fetchDashboardData();
    } catch (progressError) {
      toast.error(progressError.response?.data?.message || 'Could not update progress');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleAvailabilityChange = async (availability) => {
    try {
      setAvailabilityUpdating(true);
      const response = await api.put('/freelancer/profile', { availability });
      if (response.data.success) {
        toast.success(`Availability set to ${availability.replace('_', ' ')}`);
        updateUser({
          ...user,
          freelancer_profile: response.data.data.freelancerProfile,
        });
      }
    } catch (availabilityError) {
      toast.error(availabilityError.response?.data?.message || 'Could not update availability');
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const mySkills = (user?.freelancer_profile?.skills || []).map((skill) => skill.toLowerCase());

  const togglePinTask = (taskId) => {
    if (!preferences.quickActions.pinning || !taskId) return;

    setPinnedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [taskId, ...prev],
    );
  };

  const handleTaskSortChange = useCallback(
    (nextSort) => {
      setTaskSort(nextSort);
      updateBoardState({ sort: nextSort });
    },
    [updateBoardState],
  );

  const handleFilterStatusChange = useCallback(
    (nextFilter) => {
      setFilterStatus(nextFilter);
      updateBoardState({ filter: nextFilter });
    },
    [updateBoardState],
  );

  const taskLayout = boardState.view || preferences.taskLayout || 'list';
  const handleTaskLayoutChange = useCallback(
    (nextLayout) => {
      setPreference('taskLayout', nextLayout);
      updateBoardState({ view: nextLayout });
    },
    [setPreference, updateBoardState],
  );

  useRealtimeEvents(
    useCallback(
      (event) => {
        const type = event?.type;
        if (!type) return;

        const refreshEvents = new Set([
          'task.status_changed',
          'task.progress.updated',
          'task.comment.created',
          'task.subtask.created',
          'task.subtask.updated',
          'task.subtask.deleted',
          'offer.new',
          'offer.updated',
          'notification.created',
          'settings.preferences.updated',
          'settings.preset.applied',
          'settings.board.updated',
        ]);

        if (refreshEvents.has(type)) {
          fetchDashboardData({ silent: true });
        }

        if (type === 'review.new') {
          toast.success('New review received');
          if (activeTab === 'reviews') {
            fetchReviews();
          }
        }

        if (type === 'payout.new') {
          toast.success('New payout update available');
          if (activeTab === 'earnings') {
            fetchEarnings();
          }
        }
      },
      [activeTab, fetchDashboardData, fetchEarnings, fetchReviews],
    ),
  );

  const processTasks = useCallback(
    (tasks, { allowStatusFilter = false } = {}) => {
      let filtered = [...tasks];

      if (allowStatusFilter && filterStatus !== 'all') {
        filtered = filtered.filter((task) => task.status === filterStatus);
      }

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        filtered = filtered.filter((task) => {
          const title = getTaskTitle(task).toLowerCase();
          const description = getTaskDescription(task).toLowerCase();
          return title.includes(query) || description.includes(query);
        });
      }

      if (!allowStatusFilter && matchSkills && mySkills.length > 0) {
        filtered = filtered.filter((task) => {
          const haystack = `${getTaskTitle(task)} ${getTaskDescription(task)}`.toLowerCase();
          return mySkills.some((skill) => haystack.includes(skill));
        });
      }

      const sorted = filtered.sort((left, right) => {
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
    },
    [filterStatus, matchSkills, mySkills, taskSort, searchTerm, preferences.quickActions.pinning, pinnedTaskIds],
  );

  const filteredMyTasks = useMemo(() => processTasks(myTasks, { allowStatusFilter: true }), [myTasks, processTasks]);
  const filteredAvailableTasks = useMemo(() => processTasks(availableTasks), [availableTasks, processTasks]);

  const boardMatchers = useMemo(
    () => ({
      active: (status) => [TASK_STATUS.ASSIGNED, TASK_STATUS.IN_PROGRESS].includes(status),
      review: (status) => [TASK_STATUS.SUBMITTED_WORK, TASK_STATUS.QA_REVIEW].includes(status),
      done: (status) => status === TASK_STATUS.COMPLETED,
      other: (status) =>
        ![
          TASK_STATUS.ASSIGNED,
          TASK_STATUS.IN_PROGRESS,
          TASK_STATUS.SUBMITTED_WORK,
          TASK_STATUS.QA_REVIEW,
          TASK_STATUS.COMPLETED,
        ].includes(status),
    }),
    [],
  );

  const boardColumns = useMemo(
    () =>
      (orderedColumns.length > 0
        ? orderedColumns
        : [
            { id: 'active', title: 'Active' },
            { id: 'review', title: 'Review' },
            { id: 'done', title: 'Done' },
            { id: 'other', title: 'Other' },
          ]
      ).map((column) => ({
        ...column,
        matcher: boardMatchers[column.id] || (() => false),
      })),
    [boardMatchers, orderedColumns],
  );

  const taskColumnOverrides = useMemo(() => {
    const overrideMap = {};
    Object.entries(boardState.taskOrder || {}).forEach(([columnId, taskIds]) => {
      (Array.isArray(taskIds) ? taskIds : []).forEach((taskId) => {
        overrideMap[taskId] = columnId;
      });
    });
    return overrideMap;
  }, [boardState.taskOrder]);

  const groupedMyTasks = useMemo(() => {
    const grouped = boardColumns.reduce((acc, column) => {
      acc[column.id] = [];
      return acc;
    }, {});

    filteredMyTasks.forEach((task) => {
      const taskId = getTaskId(task);
      const manualColumn = taskColumnOverrides[taskId];

      if (manualColumn && grouped[manualColumn]) {
        grouped[manualColumn].push(task);
        return;
      }

      const defaultColumn =
        boardColumns.find((column) => column.matcher(task.status))?.id ||
        boardColumns[boardColumns.length - 1]?.id;

      if (defaultColumn) {
        grouped[defaultColumn].push(task);
      }
    });

    return boardColumns.map((column) => ({
      ...column,
      tasks: sortTasksByColumnOrder(column.id, grouped[column.id] || []),
    }));
  }, [boardColumns, filteredMyTasks, sortTasksByColumnOrder, taskColumnOverrides]);

  const deadlineRailTasks = useMemo(
    () =>
      myTasks
        .filter((task) => {
          const due = getTaskDeadline(task);
          if (!due) return false;
          if ([TASK_STATUS.COMPLETED, TASK_STATUS.CANCELLED].includes(task.status)) return false;
          return !Number.isNaN(new Date(due).getTime());
        })
        .sort((left, right) => new Date(getTaskDeadline(left)) - new Date(getTaskDeadline(right)))
        .slice(0, 6),
    [myTasks],
  );

  const earningsSummary = useMemo(() => {
    const released = earnings
      .filter((payment) => payment.status === 'released')
      .reduce((sum, payment) => sum + Number(payment.amounts?.freelancerPayout || 0), 0);

    const escrowed = earnings
      .filter((payment) => payment.status === 'escrowed')
      .reduce((sum, payment) => sum + Number(payment.amounts?.freelancerPayout || 0), 0);

    const last7Days = earnings
      .filter((payment) => {
        if (payment.status !== 'released') return false;
        const createdAt = new Date(payment.created_at || payment.createdAt || 0).getTime();
        if (Number.isNaN(createdAt)) return false;
        return Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000;
      })
      .reduce((sum, payment) => sum + Number(payment.amounts?.freelancerPayout || 0), 0);

    return {
      released,
      escrowed,
      last7Days,
    };
  }, [earnings]);

  const goalsProgress = useMemo(() => {
    const earningsGoal = Math.max(1, Number(preferences.goals.weeklyEarnings || 1));
    const tasksGoal = Math.max(1, Number(preferences.goals.weeklyCompletedTasks || 1));

    const earningsValue = earningsSummary.last7Days || Number(stats.totalEarnings || 0);
    const completedValue = Number(stats.completedTasks || 0);

    return {
      earnings: {
        value: earningsValue,
        goal: earningsGoal,
        progress: Math.min(100, Math.round((earningsValue / earningsGoal) * 100)),
      },
      completed: {
        value: completedValue,
        goal: tasksGoal,
        progress: Math.min(100, Math.round((completedValue / tasksGoal) * 100)),
      },
    };
  }, [preferences.goals.weeklyEarnings, preferences.goals.weeklyCompletedTasks, earningsSummary.last7Days, stats.totalEarnings, stats.completedTasks]);

  const exportEarningsCsv = () => {
    if (earnings.length === 0) {
      toast.error('No earnings data to export');
      return;
    }

    const header = ['Task', 'Client', 'Amount', 'Status', 'Date'];
    const rows = earnings.map((payment) => [
      payment.task?.task_details?.title || 'Untitled',
      `${payment.client?.profile?.firstName || ''} ${payment.client?.profile?.lastName || ''}`.trim(),
      Number(payment.amounts?.freelancerPayout || 0),
      payment.status || '',
      formatDate(payment.created_at || payment.createdAt),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => csvEscape(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasknexus-freelancer-earnings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success('Earnings CSV exported');
  };

  const handleBoardTaskDragStart = (taskId, fromColumnId) => {
    setDraggingTask({ taskId, fromColumnId });
  };

  const handleBoardTaskDrop = (toColumnId, insertAt = 0) => {
    if (!draggingTask?.taskId) return;
    moveTask(draggingTask.taskId, draggingTask.fromColumnId, toColumnId, insertAt);
    setDraggingTask(null);
  };

  const handleBoardColumnDragStart = (columnId) => {
    setDraggingColumn(columnId);
  };

  const handleBoardColumnDrop = (toColumnId) => {
    if (!draggingColumn || draggingColumn === toColumnId) return;
    const fromIndex = boardColumns.findIndex((column) => column.id === draggingColumn);
    const toIndex = boardColumns.findIndex((column) => column.id === toColumnId);
    if (fromIndex >= 0 && toIndex >= 0) {
      reorderColumns(fromIndex, toIndex);
    }
    setDraggingColumn(null);
  };

  if (loading) {
    return <Loading fullScreen={true} text="Loading freelancer workspace..." />;
  }

  if (error && !stats.totalTasks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center px-4">
        <div className="text-center max-w-lg bg-white/90 border border-slate-100 rounded-3xl p-8 shadow-xl">
          <AlertCircle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Unable to load workspace</h2>
          <p className="text-slate-600 mb-5">{error}</p>
          <button onClick={handleRefresh} className="btn btn-primary">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="backdrop-blur bg-white/80 shadow-sm sticky top-0 z-20 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">TN</div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">TaskNexus</h1>
                <p className="text-xs sm:text-sm text-slate-500">Freelancer Workspace</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={() => handleAvailabilityChange('available')}
                disabled={availabilityUpdating}
                className={`btn-sm rounded-full px-3 ${user?.freelancer_profile?.availability === 'available' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Available
              </button>
              <button
                onClick={() => handleAvailabilityChange('busy')}
                disabled={availabilityUpdating}
                className={`btn-sm rounded-full px-3 ${user?.freelancer_profile?.availability === 'busy' ? 'btn-primary' : 'btn-secondary'}`}
              >
                Busy
              </button>
              <button onClick={handleRefresh} disabled={refreshing} className="btn-sm btn-secondary flex items-center rounded-full px-4">
                <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button onClick={() => navigate('/freelancer/profile')} className="btn-sm btn-secondary rounded-full px-4">
                Profile
              </button>
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
          <section className="relative overflow-hidden rounded-2xl border border-slate-100 shadow-lg bg-gradient-to-r from-primary-500 via-indigo-500 to-cyan-500 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_78%_0%,rgba(255,255,255,0.18),transparent_30%)]" />
            <div className="relative p-8">
              <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.profile?.firstName || 'Freelancer'}</h2>
              <p className="text-white/90">Run your workflow with board views, goals, smart filters, and progress controls.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <HeroBadge><Star className="w-4 h-4 mr-1" />{stats.rating || 0}/5 rating</HeroBadge>
                <HeroBadge><Award className="w-4 h-4 mr-1" />{stats.onTimeDeliveryRate || 0}% on-time</HeroBadge>
                <HeroBadge><Target className="w-4 h-4 mr-1" />{taskLayout} layout</HeroBadge>
              </div>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          <StatCard title="Active Tasks" value={stats.activeTasks || 0} icon={<Activity className="w-8 h-8 text-primary-600" />} color="bg-primary-50" />
          <StatCard title="Pending Review" value={stats.pendingTasks || 0} icon={<Clock className="w-8 h-8 text-amber-600" />} color="bg-amber-50" />
          <StatCard title="Completed" value={stats.completedTasks || 0} icon={<CheckCircle className="w-8 h-8 text-emerald-600" />} color="bg-emerald-50" />
          <StatCard title="Total Earned" value={preferences.hideFinancials ? 'Hidden' : formatCurrency(stats.totalEarnings || 0)} icon={<DollarSign className="w-8 h-8 text-green-600" />} color="bg-green-50" />
          <StatCard title="Pending Payout" value={preferences.hideFinancials ? 'Hidden' : formatCurrency(stats.pendingEarnings || 0)} icon={<DollarSign className="w-8 h-8 text-orange-600" />} color="bg-orange-50" />
          <StatCard title="Performance" value={stats.performanceScore || 0} icon={<Target className="w-8 h-8 text-violet-600" />} color="bg-violet-50" />
        </section>

        {preferences.showAdvancedStats && (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <InsightCard title="Weekly Earnings Goal" value={`${goalsProgress.earnings.progress}%`} subtitle={`${preferences.hideFinancials ? 'Hidden' : formatCurrency(goalsProgress.earnings.value)} / ${preferences.hideFinancials ? 'Hidden' : formatCurrency(goalsProgress.earnings.goal)}`} />
            <InsightCard title="Completed Goal" value={`${goalsProgress.completed.progress}%`} subtitle={`${goalsProgress.completed.value} / ${goalsProgress.completed.goal} tasks`} />
            <InsightCard title="Last 7 Days" value={preferences.hideFinancials ? 'Hidden' : formatCurrency(earningsSummary.last7Days)} subtitle="Released payouts" />
            <InsightCard title="Escrowed" value={preferences.hideFinancials ? 'Hidden' : formatCurrency(earningsSummary.escrowed)} subtitle="Pending release" />
          </section>
        )}

        {preferences.showDeadlineRail && deadlineRailTasks.length > 0 && (
          <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm uppercase tracking-wide font-semibold text-slate-500 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary-600" />
                Due Soon
              </h3>
              <p className="text-xs text-slate-500">Your nearest active deadlines.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {deadlineRailTasks.map((task) => {
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
            presets={presets}
            activePresetId={activePresetId}
            applyPreset={applyPreset}
            savePreset={savePreset}
            savingPreferences={savingPreferences || loadingPreferences}
            syncError={syncError}
            title="Freelancer Workspace Settings"
          />
        </section>

        <section className="bg-white/90 border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav className="flex flex-wrap gap-2">
              {[
                { id: 'myTasks', label: `My Tasks (${myTasks.length})` },
                { id: 'available', label: `Available (${availableTasks.length})` },
                { id: 'earnings', label: 'Earnings' },
                { id: 'reviews', label: `Reviews (${stats.totalReviews || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              {['list', 'grid', 'board'].map((layout) => (
                <button
                  key={layout}
                  type="button"
                  onClick={() => handleTaskLayoutChange(layout)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${
                    taskLayout === layout
                      ? 'bg-primary-50 text-primary-700 border-primary-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-primary-200'
                  }`}
                >
                  {layout}
                </button>
              ))}
              <button type="button" onClick={resetBoardState} className="btn-sm btn-secondary">
                Reset Board
              </button>
              {savingBoard && <span className="text-[11px] text-slate-500">Saving board...</span>}
            </div>
          </div>

          {(activeTab === 'myTasks' || activeTab === 'available') && (
            <div className="px-5 py-4 border-b border-slate-100 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search tasks by title or description"
                    className="input pl-9 py-2"
                  />
                </div>

                {activeTab === 'myTasks' ? (
                  <label className="block">
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Status</p>
                    <select
                      value={filterStatus}
                      onChange={(event) => handleFilterStatusChange(event.target.value)}
                      className="input py-2"
                    >
                      {MY_TASK_FILTER_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={matchSkills}
                      onChange={(event) => setMatchSkills(event.target.checked)}
                      className="accent-primary-600"
                    />
                    <span>Match my skills</span>
                  </label>
                )}

                <label className="block">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-slate-500 mb-1.5">Sort</p>
                  <select
                    value={taskSort}
                    onChange={(event) => handleTaskSortChange(event.target.value)}
                    className="input py-2"
                  >
                    {TASK_SORT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}

          <div className="p-5">
            {activeTab === 'myTasks' && (
              filteredMyTasks.length === 0 ? (
                <EmptyState icon={Briefcase} title="No tasks found" description="Try adjusting your filters or accept new work." />
              ) : taskLayout === 'board' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                  {groupedMyTasks.map((column) => (
                    <div
                      key={column.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                      draggable
                      onDragStart={() => handleBoardColumnDragStart(column.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleBoardColumnDrop(column.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-700">{column.title}</h4>
                        <span className="text-xs font-semibold text-slate-500">{column.tasks.length}</span>
                      </div>
                      <div
                        className="space-y-2 min-h-[60px]"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleBoardTaskDrop(column.id, column.tasks.length)}
                      >
                        {column.tasks.map((task, index) => (
                          <BoardTaskCard
                            key={getTaskId(task)}
                            task={task}
                            columnId={column.id}
                            onDragStart={handleBoardTaskDragStart}
                            onDropAt={(toColumnId) => handleBoardTaskDrop(toColumnId, index)}
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
                  {filteredMyTasks.map((task) => (
                    <FreelancerTaskCard
                      key={getTaskId(task)}
                      task={task}
                      onView={() => {
                        setSelectedTask(task);
                        setShowDetailsModal(true);
                      }}
                      isPinned={pinnedTaskIds.includes(getTaskId(task))}
                      onTogglePin={() => togglePinTask(getTaskId(task))}
                      canPin={preferences.quickActions.pinning}
                      hideFinancials={preferences.hideFinancials}
                      preferences={preferences}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'available' && (
              filteredAvailableTasks.length === 0 ? (
                <EmptyState icon={Search} title="No available tasks" description="Check back later for new opportunities." />
              ) : (
                <div className={taskLayout === 'grid' ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : 'space-y-4'}>
                  {filteredAvailableTasks.map((task) => (
                    <FreelancerTaskCard
                      key={getTaskId(task)}
                      task={task}
                      onView={() => {
                        setSelectedTask(task);
                        setShowDetailsModal(true);
                      }}
                      isPinned={pinnedTaskIds.includes(getTaskId(task))}
                      onTogglePin={() => togglePinTask(getTaskId(task))}
                      canPin={preferences.quickActions.pinning}
                      hideFinancials={preferences.hideFinancials}
                      preferences={preferences}
                      isAvailable={true}
                      onAccept={() => handleAcceptTask(getTaskId(task))}
                    />
                  ))}
                </div>
              )
            )}

            {activeTab === 'earnings' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-900">Earnings Overview</h3>
                  {preferences.quickActions.export && (
                    <button onClick={exportEarningsCsv} className="btn btn-secondary">Export CSV</button>
                  )}
                </div>
                {earnings.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No earnings yet" description="Complete tasks to start earning." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Task</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {earnings.map((payment) => (
                          <tr key={payment.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 text-sm text-slate-900">{payment.task?.task_details?.title || 'Untitled task'}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{payment.client?.profile?.firstName} {payment.client?.profile?.lastName}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{preferences.hideFinancials ? 'Hidden' : formatCurrency(payment.amounts?.freelancerPayout)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{payment.status}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{formatDate(payment.created_at || payment.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              reviews.length === 0 ? (
                <EmptyState icon={Star} title="No reviews yet" description="Complete more work to collect reviews." />
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">{review.task?.task_details?.title || 'Untitled task'}</p>
                          <p className="text-sm text-slate-600">{review.reviewer?.profile?.firstName} {review.reviewer?.profile?.lastName}</p>
                        </div>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, idx) => (
                            <Star key={idx} className={`w-4 h-4 ${idx < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                          ))}
                        </div>
                      </div>
                      {review.feedback && <p className="text-sm text-slate-700 mb-2">{review.feedback}</p>}
                      <p className="text-xs text-slate-500">{formatDate(review.created_at || review.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </section>
      </main>

      <TaskDetailsModal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        task={selectedTask}
        onStartWorking={handleStartWorking}
        onCancelTask={handleCancelTask}
        onUpdateProgress={handleUpdateProgress}
      />
    </div>
  );
};

const FreelancerTaskCard = ({
  task,
  onView,
  isPinned,
  onTogglePin,
  canPin,
  hideFinancials,
  preferences,
  isAvailable = false,
  onAccept,
}) => {
  const compact = preferences?.compactCards;
  const progress = task?.metrics?.progress ?? null;
  const dueBadge = getDueBadge(task);

  return (
    <div className={`border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-5'} hover:shadow-lg transition bg-white`}>
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900 line-clamp-1">{getTaskTitle(task)}</p>
          <p className="text-sm text-slate-600 line-clamp-2 mt-1">{getTaskDescription(task)}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {!isAvailable && <StatusBadge status={task.status} />}
          {canPin && (
            <button onClick={onTogglePin} className="text-slate-400 hover:text-amber-500 transition" type="button">
              <Star className={`w-4 h-4 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-4">
        <span className="inline-flex items-center"><DollarSign className="w-4 h-4 mr-1 text-emerald-600" />{hideFinancials ? 'Hidden' : formatCurrency(getTaskBudget(task))}</span>
        <span className="inline-flex items-center"><Calendar className="w-4 h-4 mr-1 text-blue-600" />{formatDate(getTaskDeadline(task))}</span>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeTone(dueBadge.tone)}`}>{dueBadge.label}</span>
        {progress !== null && <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-full">{progress}% complete</span>}
      </div>

      {progress !== null && preferences?.showProgressBars && (
        <div className="mb-4">
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="h-2 rounded-full bg-gradient-to-r from-primary-500 to-cyan-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-2">
        <button onClick={onView} className="btn-sm btn-secondary flex items-center" type="button">
          <Eye className="w-4 h-4 mr-1" />
          View
        </button>
        {isAvailable && onAccept && (
          <button onClick={onAccept} className="btn-sm btn-primary" type="button">
            Accept Task
          </button>
        )}
      </div>
    </div>
  );
};

const BoardTaskCard = ({
  task,
  columnId,
  onDragStart,
  onDropAt,
  onClick,
  isPinned,
  onTogglePin,
  canPin,
}) => {
  const dueBadge = getDueBadge(task);

  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3 cursor-grab"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        onDragStart?.(getTaskId(task), columnId);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDropAt?.(columnId);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onClick} className="text-left min-w-0">
          <p className="text-sm font-semibold text-slate-900 line-clamp-1">{getTaskTitle(task)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatDate(getTaskDeadline(task))}</p>
        </button>
        {canPin && (
          <button onClick={onTogglePin} type="button" className="text-slate-400 hover:text-amber-500">
            <Star className={`w-4 h-4 ${isPinned ? 'fill-amber-400 text-amber-500' : ''}`} />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <StatusBadge status={task.status} />
        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${badgeTone(dueBadge.tone)}`}>{dueBadge.label}</span>
      </div>
    </div>
  );
};

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

export default FreelancerDashboard;
