// backend/src/data/taskData.js
const supabase = require("../config/supabase");
const logger = require("../utils/logger");
const localTaskStore = require("./localTaskStore");
const {
  buildSupabaseError,
  isSupabaseNetworkError,
  isSupabaseNoRowsError,
} = require("../utils/supabaseErrors");

let localFallbackLogged = false;

const isLocalFallbackEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.DISABLE_LOCAL_AUTH_FALLBACK !== "true";

const logLocalFallbackOnce = () => {
  if (localFallbackLogged) return;
  localFallbackLogged = true;
  logger.warn(
    "Supabase is unreachable. Using local task fallback store for development."
  );
};

const runQuery = async (queryFactory, action, options = {}) => {
  try {
    const { data, error } = await queryFactory();

    if (error) {
      if (options.allowNoRows && isSupabaseNoRowsError(error)) {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    if (isLocalFallbackEnabled() && isSupabaseNetworkError(error)) {
      logLocalFallbackOnce();
      return options.fallbackAction();
    }

    if (options.allowNoRows && isSupabaseNoRowsError(error)) {
      return null;
    }

    throw buildSupabaseError(error, action, {
      allowNoRows: options.allowNoRows,
    });
  }
};

const createTask = async (taskData) => {
  // Generate unique task ID: TSK-YYYYMMDD-XXXXX
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(10000 + Math.random() * 90000);
  const payload = {
    ...taskData,
    task_id: taskData.task_id || `TSK-${dateStr}-${random}`,
  };

  const data = await runQuery(
    () => supabase.from("tasks").insert([payload]).select(),
    "creating task",
    {
      fallbackAction: () => localTaskStore.createTask(payload),
    }
  );

  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
};

const findTaskById = async (id) => {
  return runQuery(
    () => supabase.from("tasks").select("*").eq("id", id).single(),
    "finding task by id",
    {
      allowNoRows: true,
      fallbackAction: () => localTaskStore.findTaskById(id),
    }
  );
};

const findTasks = async (filters) => {
  const queryFactory = () => {
    let query = supabase.from("tasks").select("*");

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (key.includes("->>")) {
          const [column, jsonPath] = key.split("->>");
          query = query.filter(`${column}->>${jsonPath}`, "eq", value);
          return;
        }

        if (key.includes("->")) {
          const [column, jsonPath] = key.split("->");
          query = query.filter(`${column}->${jsonPath}`, "eq", value);
          return;
        }

        // Supabase needs `.is(..., null)` for nullable columns; `.eq` with null throws
        if (value === null) {
          query = query.is(key, null);
          return;
        }

        // Allow basic `IN` filtering when an array is passed
        if (Array.isArray(value)) {
          query = query.in(key, value);
          return;
        }

        query = query.eq(key, value);
      });
    }

    return query;
  };

  return runQuery(queryFactory, "finding tasks", {
    fallbackAction: () => localTaskStore.findTasks(filters),
  });
};

const listTasks = async ({ filters = {}, page, limit, sortBy, sortOrder, search }) => {
  const queryFactory = async () => {
    let query = supabase.from("tasks").select("*", { count: "exact" });
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null) query = query.is(key, null);
      else if (Array.isArray(value)) query = query.in(key, value);
      else if (key.includes("->>")) query = query.filter(key, "eq", value);
      else query = query.eq(key, value);
    });
    if (search) query = query.ilike("task_details->>title", `%${search}%`);
    const from = (page - 1) * limit;
    const result = await query
      .order(sortBy, { ascending: sortOrder === "asc" })
      .range(from, from + limit - 1);
    return result;
  };

  try {
    const { data, error, count } = await queryFactory();
    if (error) throw error;
    return { items: data || [], total: count || 0, page, limit };
  } catch (error) {
    if (isLocalFallbackEnabled() && isSupabaseNetworkError(error)) {
      logLocalFallbackOnce();
      return localTaskStore.listTasks({ filters, page, limit, sortBy, sortOrder, search });
    }
    throw buildSupabaseError(error, "listing tasks");
  }
};

const updateTask = async (id, updates) => {
  const data = await runQuery(
    () => supabase.from("tasks").update(updates).eq("id", id).select(),
    "updating task",
    {
      fallbackAction: () => localTaskStore.updateTask(id, updates),
    }
  );

  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
};

const updateTaskIfStatus = async (id, expectedStatus, updates) => {
  return runQuery(
    () =>
      supabase
        .from("tasks")
        .update(updates)
        .eq("id", id)
        .eq("status", expectedStatus)
        .select()
        .maybeSingle(),
    "transitioning task",
    {
      allowNoRows: true,
      fallbackAction: () =>
        localTaskStore.updateTaskIfStatus(id, expectedStatus, updates),
    },
  );
};

const acceptTaskAtomically = async (id, freelancerId) => {
  const data = await runQuery(
    () =>
      supabase.rpc("accept_task", {
        p_task_id: id,
        p_freelancer_id: freelancerId,
      }),
    "accepting task",
    {
      fallbackAction: () => localTaskStore.acceptTaskAtomically(id, freelancerId),
    },
  );
  return Array.isArray(data) ? data[0] || null : data;
};

module.exports = {
  createTask,
  findTaskById,
  findTasks,
  listTasks,
  updateTask,
  updateTaskIfStatus,
  acceptTaskAtomically,
};
