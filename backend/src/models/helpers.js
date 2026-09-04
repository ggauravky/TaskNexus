const { randomUUID } = require("crypto");
const mongoose = require("mongoose");

const json = { type: mongoose.Schema.Types.Mixed, default: undefined };
const stringId = (required = true) => ({
  type: String,
  required,
  default: required ? randomUUID : undefined,
});

const schemaOptions = ({ timestamps = true } = {}) => ({
  versionKey: false,
  strict: "throw",
  minimize: false,
  timestamps: timestamps ? { createdAt: "created_at", updatedAt: "updated_at" } : false,
  toJSON: {
    transform: (_doc, value) => {
      value.id = value._id;
      delete value._id;
      return value;
    },
  },
});

const model = (name, definition, options = {}) => {
  const schema = new mongoose.Schema(definition, schemaOptions(options));
  return { schema, register: () => mongoose.models[name] || mongoose.model(name, schema, options.collection) };
};

const toApp = (value) => {
  if (!value) return value;
  const plain = typeof value.toObject === "function" ? value.toObject() : { ...value };
  if (plain._id !== undefined) {
    plain.id = String(plain._id);
    delete plain._id;
  }
  delete plain.__v;
  return plain;
};

const toApps = (values = []) => values.map(toApp);

module.exports = { json, model, randomUUID, stringId, toApp, toApps };
