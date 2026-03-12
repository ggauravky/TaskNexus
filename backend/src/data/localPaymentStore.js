const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOCAL_DATA_DIR = path.join(__dirname, "../../.local-data");
const PAYMENTS_FILE = path.join(LOCAL_DATA_DIR, "payments.json");

const ensureLocalStore = () => {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(PAYMENTS_FILE)) {
    fs.writeFileSync(PAYMENTS_FILE, "[]", "utf8");
  }
};

const readPayments = () => {
  ensureLocalStore();

  try {
    const fileContent = fs.readFileSync(PAYMENTS_FILE, "utf8");
    const parsed = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writePayments = (payments) => {
  ensureLocalStore();
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), "utf8");
};

const applyFilters = (payments, filters = {}) => {
  return payments.filter((payment) =>
    Object.entries(filters).every(([key, value]) => {
      if (Array.isArray(value)) {
        return value.includes(payment[key]);
      }
      return payment[key] === value;
    })
  );
};

const createPayment = async (paymentData) => {
  const payments = readPayments();
  const now = new Date().toISOString();

  const payment = {
    id: paymentData.id || crypto.randomUUID(),
    ...paymentData,
    created_at: paymentData.created_at || now,
    updated_at: paymentData.updated_at || now,
  };

  payments.push(payment);
  writePayments(payments);
  return payment;
};

const findPayments = async (filters) => {
  const payments = readPayments();
  if (!filters || Object.keys(filters).length === 0) {
    return payments;
  }
  return applyFilters(payments, filters);
};

const findPaymentById = async (id) => {
  const payments = readPayments();
  return payments.find((payment) => payment.id === id) || null;
};

module.exports = {
  createPayment,
  findPayments,
  findPaymentById,
};
