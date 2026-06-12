const supabase = require("../config/supabase");
const localNewsletterStore = require("./localNewsletterStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("newsletter subscription");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const upsertSubscription = async (subscriptionData) => {
  const payload = {
    source: "blog",
    status: "subscribed",
    ...subscriptionData,
    email: normalizeEmail(subscriptionData.email),
  };

  const data = await runQuery(
    () =>
      supabase
        .from("newsletter_subscriptions")
        .upsert([payload], { onConflict: "email" })
        .select(),
    "upserting newsletter subscription",
    {
      fallbackAction: () => localNewsletterStore.upsertSubscription(payload),
    }
  );

  return Array.isArray(data) ? data[0] : data;
};

const findSubscriptionByEmail = async (email) =>
  runQuery(
    () =>
      supabase
        .from("newsletter_subscriptions")
        .select("*")
        .eq("email", normalizeEmail(email))
        .single(),
    "finding newsletter subscription by email",
    {
      allowNoRows: true,
      fallbackAction: () => localNewsletterStore.findSubscriptionByEmail(email),
    }
  );

const updateSubscriptionByEmail = async (email, updates) => {
  const data = await runQuery(
    () =>
      supabase
        .from("newsletter_subscriptions")
        .update(updates)
        .eq("email", normalizeEmail(email))
        .select(),
    "updating newsletter subscription",
    {
      fallbackAction: () =>
        localNewsletterStore.updateSubscriptionByEmail(email, updates),
    }
  );

  return Array.isArray(data) ? data[0] || null : data;
};

module.exports = {
  findSubscriptionByEmail,
  upsertSubscription,
  updateSubscriptionByEmail,
};
