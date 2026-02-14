// backend/src/data/paymentData.js
const supabase = require('../config/supabase');

const createPayment = async (paymentData) => {
    // Generate unique payment ID: PAY-YYYYMMDD-XXXXXX
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(100000 + Math.random() * 900000);
    paymentData.payment_id = `PAY-${dateStr}-${random}`;

    const { data, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const findPayments = async (filters) => {
    let query = supabase.from('payments').select('*');

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

const findPaymentById = async (id) => {
    const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(error.message);
    }

    return data;
}

module.exports = {
    createPayment,
    findPayments,
    findPaymentById,
};