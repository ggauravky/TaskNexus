const supabase = require("../config/supabase");
const localSupportJarStore = require("./localSupportJarStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("support jar contribution");

const createContribution = async (contributionData) => {
  const data = await runQuery(
    () => supabase.from("support_jar_contributions").insert([contributionData]).select(),
    "creating support jar contribution",
    {
      fallbackAction: () => localSupportJarStore.createContribution(contributionData),
    }
  );

  return Array.isArray(data) ? data[0] : data;
};

const findContributionById = async (id) =>
  runQuery(
    () =>
      supabase
        .from("support_jar_contributions")
        .select("*")
        .eq("id", id)
        .single(),
    "finding support jar contribution by id",
    {
      allowNoRows: true,
      fallbackAction: () => localSupportJarStore.findContributionById(id),
    }
  );

const updateContribution = async (id, updates) => {
  const data = await runQuery(
    () =>
      supabase
        .from("support_jar_contributions")
        .update(updates)
        .eq("id", id)
        .select(),
    "updating support jar contribution",
    {
      fallbackAction: () => localSupportJarStore.updateContribution(id, updates),
    }
  );

  return Array.isArray(data) ? data[0] || null : data;
};

module.exports = {
  createContribution,
  findContributionById,
  updateContribution,
};
