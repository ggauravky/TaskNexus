const supabase = require("../config/supabase");
const { buildSupabaseError, isSupabaseNoRowsError } = require("../utils/supabaseErrors");

const execute = async (factory, action, { allowNoRows = false } = {}) => {
  try {
    const { data, error } = await factory();
    if (error) {
      if (allowNoRows && isSupabaseNoRowsError(error)) return null;
      throw error;
    }
    return data;
  } catch (error) {
    if (allowNoRows && isSupabaseNoRowsError(error)) return null;
    throw buildSupabaseError(error, action, { allowNoRows });
  }
};

const findProfileByUserId = (userId) => execute(
  () => supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
  "finding professional profile",
  { allowNoRows: true },
);

const findProfileByUsername = (username) => execute(
  () => supabase.from("user_profiles").select("*").ilike("username", username).maybeSingle(),
  "finding public profile",
  { allowNoRows: true },
);

const isUsernameTaken = async (username, excludingUserId = null) => {
  let query = supabase.from("user_profiles").select("user_id").ilike("username", username);
  if (excludingUserId) query = query.neq("user_id", excludingUserId);
  const rows = await execute(() => query.limit(1), "checking username availability");
  return Boolean(rows?.length);
};

const upsertProfile = async (userId, values) => {
  const data = await execute(
    () => supabase.from("user_profiles").upsert({ user_id: userId, ...values }, { onConflict: "user_id" }).select(),
    "saving professional profile",
  );
  return data?.[0] || null;
};

const listEducation = (userId) => execute(
  () => supabase.from("user_education").select("*").eq("user_id", userId).order("position").order("start_year", { ascending: false }),
  "listing education",
);

const createEducation = async (userId, values) => {
  const data = await execute(
    () => supabase.from("user_education").insert({ user_id: userId, ...values }).select(),
    "creating education",
  );
  return data?.[0] || null;
};

const updateEducation = async (userId, educationId, values) => {
  const data = await execute(
    () => supabase.from("user_education").update(values).eq("id", educationId).eq("user_id", userId).select().maybeSingle(),
    "updating education",
    { allowNoRows: true },
  );
  return data || null;
};

const deleteEducation = async (userId, educationId) => {
  const data = await execute(
    () => supabase.from("user_education").delete().eq("id", educationId).eq("user_id", userId).select("id").maybeSingle(),
    "deleting education",
    { allowNoRows: true },
  );
  return data || null;
};

const listUserSkills = (userId) => execute(
  () => supabase.from("user_skills").select("user_id,skill_id,proficiency,is_primary,created_at,updated_at,skill:skills(id,slug,name,category)").eq("user_id", userId).order("is_primary", { ascending: false }).order("created_at"),
  "listing profile skills",
);

const replaceUserSkills = (userId, skills) => execute(
  () => supabase.rpc("replace_user_skills", { p_user_id: userId, p_skills: skills }),
  "replacing profile skills",
);

const searchSkills = async ({ query = "", category, limit = 20 }) => {
  return execute(
    () => supabase.rpc("search_skills", {
      p_query: query,
      p_category: category || null,
      p_limit: limit,
    }),
    "searching skills",
  );
};

module.exports = {
  findProfileByUserId,
  findProfileByUsername,
  isUsernameTaken,
  upsertProfile,
  listEducation,
  createEducation,
  updateEducation,
  deleteEducation,
  listUserSkills,
  replaceUserSkills,
  searchSkills,
};
