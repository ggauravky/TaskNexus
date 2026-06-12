const supabase = require("../config/supabase");
const localServiceBookingStore = require("./localServiceBookingStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("service booking");

const createBooking = async (bookingData) => {
  const data = await runQuery(
    () => supabase.from("service_bookings").insert([bookingData]).select(),
    "creating service booking",
    {
      fallbackAction: () => localServiceBookingStore.createBooking(bookingData),
    }
  );

  return Array.isArray(data) ? data[0] : data;
};

const findBookingById = async (id) =>
  runQuery(
    () => supabase.from("service_bookings").select("*").eq("id", id).single(),
    "finding service booking by id",
    {
      allowNoRows: true,
      fallbackAction: () => localServiceBookingStore.findBookingById(id),
    }
  );

const updateBooking = async (id, updates) => {
  const data = await runQuery(
    () => supabase.from("service_bookings").update(updates).eq("id", id).select(),
    "updating service booking",
    {
      fallbackAction: () => localServiceBookingStore.updateBooking(id, updates),
    }
  );

  return Array.isArray(data) ? data[0] || null : data;
};

module.exports = {
  createBooking,
  findBookingById,
  updateBooking,
};
