const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/service-bookings.json");

const createBooking = async (payload) => {
  const bookings = readCollection(FILE_PATH);
  const record = withRecordMetadata({
    status: "requested",
    email_status: "pending",
    brevo_message_ids: null,
    ...payload,
  });

  bookings.push(record);
  writeCollection(FILE_PATH, bookings);
  return record;
};

const findBookingById = async (id) => {
  const bookings = readCollection(FILE_PATH);
  return bookings.find((booking) => booking.id === id) || null;
};

const findBookings = async (filters) => {
  const bookings = readCollection(FILE_PATH);
  return applyFilters(bookings, filters);
};

const updateBooking = async (id, updates) => {
  const bookings = readCollection(FILE_PATH);
  const index = bookings.findIndex((booking) => booking.id === id);

  if (index === -1) {
    return null;
  }

  bookings[index] = {
    ...bookings[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeCollection(FILE_PATH, bookings);
  return bookings[index];
};

module.exports = {
  createBooking,
  findBookingById,
  findBookings,
  updateBooking,
};
