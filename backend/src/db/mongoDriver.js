/**
 * MongoDB driver (Mongoose). Exposes the same mini-collection API as the other
 * drivers. Schemas live in ../models (single source of truth).
 */
const mongoose = require('mongoose');
const { SCHEMAS } = require('../models');

const models = {};

async function connect(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    models[name] = mongoose.models[name] || mongoose.model(name, schema);
  }
}

function strip(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject({ versionKey: false }) : doc;
  obj._id = String(obj._id);
  return obj;
}

function collection(name) {
  const Model = models[name];
  if (!Model) throw new Error(`Unknown collection: ${name}`);

  return {
    async find(filter = {}, opts = {}) {
      let q = Model.find(filter).lean();
      if (opts.sort) q = q.sort(opts.sort);
      if (opts.limit) q = q.limit(opts.limit);
      const docs = await q;
      return docs.map((d) => ({ ...d, _id: String(d._id) }));
    },
    async findOne(filter = {}) {
      const doc = await Model.findOne(filter).lean();
      return doc ? { ...doc, _id: String(doc._id) } : null;
    },
    async insertOne(doc) {
      const created = await Model.create(doc);
      return strip(created);
    },
    async insertMany(docs) {
      const created = await Model.insertMany(docs);
      return created.map(strip);
    },
    async updateOne(filter, patch) {
      const update = {};
      if (patch.$inc) update.$inc = patch.$inc;
      const setPart = { ...(patch.$set || {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (!k.startsWith('$')) setPart[k] = v;
      }
      // Mixed schema paths need markModified; simplest robust path: replace docs
      // wholesale for array-heavy patches via findOneAndUpdate + $set.
      if (Object.keys(setPart).length) update.$set = setPart;
      const doc = await Model.findOneAndUpdate(filter, update, { new: true }).lean();
      return doc ? { ...doc, _id: String(doc._id) } : null;
    },
    async deleteOne(filter) {
      await Model.deleteOne(filter);
      return true;
    },
    async deleteMany(filter) {
      await Model.deleteMany(filter);
      return true;
    },
    async count(filter = {}) {
      return Model.countDocuments(filter);
    }
  };
}

module.exports = { connect, collection };
