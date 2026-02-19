// backend/src/data/taskData.js
const supabase = require('../config/supabase');

const createTask = async (taskData) => {
    // Generate unique task ID: TSK-YYYYMMDD-XXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(10000 + Math.random() * 90000);
    taskData.task_id = `TSK-${dateStr}-${random}`;

    const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const findTaskById = async (id) => {
    const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(error.message);
    }

    return data;
};

const findTasks = async (filters) => {
    let query = supabase.from('tasks').select('*');

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (key.includes('->>')) {
                const [column, jsonPath] = key.split('->>');
                query = query.filter(`${column}->>${jsonPath}`, 'eq', value);
                return;
            }

            if (key.includes('->')) {
                const [column, jsonPath] = key.split('->');
                query = query.filter(`${column}->${jsonPath}`, 'eq', value);
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

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const updateTask = async (id, updates) => {
    const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
}

module.exports = {
    createTask,
    findTaskById,
    findTasks,
    updateTask,
};
