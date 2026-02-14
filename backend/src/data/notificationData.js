// backend/src/data/notificationData.js
const supabase = require('../config/supabase');

const createNotification = async (notificationData) => {
    const { data, error } = await supabase
        .from('notifications')
        .insert([notificationData])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const findNotifications = async (filters) => {
    let query = supabase.from('notifications').select('*');

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                query = query.in(key, value);
            } else {
                query = query.eq(key, value);
            }
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const updateNotification = async (id, updates) => {
    const { data, error } = await supabase
        .from('notifications')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
}

const updateManyNotifications = async (filters, updates) => {
    let query = supabase.from('notifications').update(updates);

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const deleteNotification = async (id) => {
    const { data, error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const deleteManyNotifications = async (filters) => {
    let query = supabase.from('notifications').delete();

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}


module.exports = {
    createNotification,
    findNotifications,
    updateNotification,
    updateManyNotifications,
    deleteNotification,
    deleteManyNotifications,
};