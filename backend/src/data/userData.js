// backend/src/data/userData.js
const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

const createUser = async (userData) => {
  const { email, password, role, profile, freelancerProfile, clientProfile } = userData;

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const { data, error } = await supabase
    .from('users')
    .insert([
      {
        email,
        password: hashedPassword,
        role,
        profile,
        freelancer_profile: freelancerProfile,
        client_profile: clientProfile,
      },
    ])
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return data[0];
};

const findUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    throw new Error(error.message);
  }

  return data;
};

const findUserById = async (id) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(error.message);
    }

    return data;
};

const findUsers = async (filters) => {
    let query = supabase.from('users').select('*');

    if (filters) {
        for (const [key, value] of Object.entries(filters)) {
            if (key.includes('->')) {
                const [jsonbField, property] = key.split('->');
                if (Array.isArray(value)) {
                    query = query.contains(jsonbField, value);
                } else {
                    query = query.eq(`${jsonbField}->>${property}`, value);
                }
            } else {
                query = query.eq(key, value);
            }
        }
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

const updateUser = async (id, updates) => {
    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data[0];
};

const comparePassword = async (candidatePassword, userPassword) => {
    return await bcrypt.compare(candidatePassword, userPassword);
};


module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUsers,
  updateUser,
  comparePassword,
};