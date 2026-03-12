// backend/src/data/userData.js
const supabase = require("../config/supabase");
const bcrypt = require("bcrypt");
const logger = require("../utils/logger");
const localUserStore = require("./localUserStore");
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
    "Supabase is unreachable. Using local auth fallback store for development."
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

const createUser = async (userData) => {
  const { email, password, role, profile, freelancerProfile, clientProfile } =
    userData;

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const payload = {
    email,
    password: hashedPassword,
    role,
    profile,
    freelancer_profile: freelancerProfile,
    client_profile: clientProfile,
  };

  const data = await runQuery(
    () => supabase.from("users").insert([payload]).select(),
    "creating user",
    {
      fallbackAction: () =>
        localUserStore.createUser({
          email,
          password: hashedPassword,
          role,
          profile,
          freelancerProfile,
          clientProfile,
        }),
    }
  );

  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
};

const findUserByEmail = async (email) => {
  return runQuery(
    () => supabase.from("users").select("*").eq("email", email).single(),
    "finding user by email",
    {
      allowNoRows: true,
      fallbackAction: () => localUserStore.findUserByEmail(email),
    }
  );
};

const findUserById = async (id) => {
  return runQuery(
    () => supabase.from("users").select("*").eq("id", id).single(),
    "finding user by id",
    {
      allowNoRows: true,
      fallbackAction: () => localUserStore.findUserById(id),
    }
  );
};

const findUsers = async (filters) => {
  const query = () => {
    let builtQuery = supabase.from("users").select("*");

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (key.includes("->")) {
          const [jsonbField, property] = key.split("->");
          if (Array.isArray(value)) {
            builtQuery = builtQuery.contains(jsonbField, value);
          } else {
            builtQuery = builtQuery.eq(`${jsonbField}->>${property}`, value);
          }
        } else if (Array.isArray(value)) {
          builtQuery = builtQuery.in(key, value);
        } else {
          builtQuery = builtQuery.eq(key, value);
        }
      }
    }

    return builtQuery;
  };

  return runQuery(query, "finding users", {
    fallbackAction: () => localUserStore.findUsers(filters),
  });
};

const updateUser = async (id, updates) => {
  const data = await runQuery(
    () => supabase.from("users").update(updates).eq("id", id).select(),
    "updating user",
    {
      fallbackAction: () => localUserStore.updateUser(id, updates),
    }
  );

  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
};

const comparePassword = async (candidatePassword, userPassword) => {
  return bcrypt.compare(candidatePassword, userPassword);
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUsers,
  updateUser,
  comparePassword,
};
