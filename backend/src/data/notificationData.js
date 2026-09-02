// backend/src/data/notificationData.js
const supabase = require('../config/supabase');
const localNotificationStore = require("./localNotificationStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("notification");

const createNotification = async (notificationData) => {
    const data = await runQuery(
        () => supabase.from('notifications').insert([notificationData]).select(),
        "creating notification",
        {
            fallbackAction: () => localNotificationStore.createNotification(notificationData),
        }
    );
    return Array.isArray(data) ? data[0] : data;
};

const findNotifications = async (filters) => {
    const queryFactory = () => {
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
        return query;
    };

    return runQuery(queryFactory, "finding notifications", {
        fallbackAction: () => localNotificationStore.findNotifications(filters),
    });
};

const listNotifications = async ({ filters, page, limit }) => {
    const from = (page - 1) * limit;
    const queryFactory = () => {
        let query = supabase.from('notifications').select('*', { count: 'exact' });
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
        return query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    };
    try {
        const { data, error, count } = await queryFactory();
        if (error) throw error;
        return { items: data || [], total: count || 0, page, limit };
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            return localNotificationStore.listNotifications({ filters, page, limit });
        }
        throw error;
    }
};

const updateNotification = async (id, updates) => {
    const data = await runQuery(
        () => supabase.from('notifications').update(updates).eq('id', id).select(),
        "updating notification",
        {
            fallbackAction: () => localNotificationStore.updateNotification(id, updates),
        }
    );
    return Array.isArray(data) ? data[0] : data;
};

const updateManyNotifications = async (filters, updates) => {
    const queryFactory = () => {
        let query = supabase.from('notifications').update(updates);
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }
        return query.select();
    };

    return runQuery(queryFactory, "updating multiple notifications", {
        fallbackAction: () => localNotificationStore.updateManyNotifications(filters, updates),
    });
};

const deleteNotification = async (id) => {
    const data = await runQuery(
        () => supabase.from('notifications').delete().eq('id', id).select(),
        "deleting notification",
        {
            fallbackAction: () => localNotificationStore.deleteNotification(id),
        }
    );
    return data;
};

const deleteManyNotifications = async (filters) => {
    const queryFactory = () => {
        let query = supabase.from('notifications').delete();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
        }
        return query.select();
    };

    return runQuery(queryFactory, "deleting multiple notifications", {
        fallbackAction: () => localNotificationStore.deleteManyNotifications(filters),
    });
};

module.exports = {
    createNotification,
    findNotifications,
    listNotifications,
    updateNotification,
    updateManyNotifications,
    deleteNotification,
    deleteManyNotifications,
};
