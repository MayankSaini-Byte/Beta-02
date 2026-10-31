/**
 * In-memory driver - powers zero-config Demo Mode.
 * Implements the same mini-collection API as the Mongo driver.
 */
const crypto = require('crypto');

const store = new Map();

function rid() {
  return crypto.randomUUID();
}

function clone(doc) {
  return doc == null ? doc : JSON.parse(JSON.stringify(doc));
}

function matches(doc, filter) {
  for (const [key, cond] of Object.entries(filter)) {
    const value = doc[key];
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond)) {
      if ('$in' in cond) {
        if (!cond.$in.map(String).includes(String(value))) return false;
      } else if ('$ne' in cond) {
        if (String(value) === String(cond.$ne)) return false;
      } else if ('$gte' in cond) {
        if (!(String(value) >= String(cond.$gte))) return false;
      } else if ('$lte' in cond) {
        if (!(String(value) <= String(cond.$lte))) return false;
      } else if ('$gt' in cond) {
        if (!(String(value) > String(cond.$gt))) return false;
      } else if ('$lt' in cond) {
        if (!(String(value) < String(cond.$lt))) return false;
      } else if ('$exists' in cond) {
        if (cond.$exists !== (value !== undefined)) return false;
      } else {
        return false;
      }
    } else if (String(value) !== String(cond)) {
      return false;
    }
  }
  return true;
}

function sortDocs(docs, sort) {
  const entries = Object.entries(sort);
  return docs.sort((a, b) => {
    for (const [field, dir] of entries) {
      const av = a[field];
      const bv = b[field];
      if (av === bv) continue;
      const res = av > bv ? 1 : -1;
      return dir === -1 || dir === 'desc' ? -res : res;
    }
    return 0;
  });
}

class MemCollection {
  constructor(name) {
    this.name = name;
    if (!store.has(name)) store.set(name, []);
    this.docs = store.get(name);
  }

  async find(filter = {}, opts = {}) {
    let out = this.docs.filter((d) => matches(d, filter));
    if (opts.sort) out = [...sortDocs(out, opts.sort)];
    if (opts.limit) out = out.slice(0, opts.limit);
    return out.map(clone);
  }

  async findOne(filter = {}, opts = {}) {
    let candidates = this.docs.filter((d) => matches(d, filter));
    if (opts.sort) candidates = sortDocs([...candidates], opts.sort);
    const doc = candidates[0];
    return clone(doc || null);
  }

  async insertOne(doc) {
    const now = new Date().toISOString();
    const id = doc._id ? String(doc._id) : rid();
    const record = {
      createdAt: doc.createdAt || now,
      updatedAt: doc.updatedAt || now,
      ...clone(doc),
      _id: id
    };
    this.docs.push(record);
    return clone(record);
  }

  async insertMany(docs) {
    const out = [];
    for (const d of docs) out.push(await this.insertOne(d));
    return out;
  }

  async updateOne(filter, patch) {
    const doc = this.docs.find((d) => matches(d, filter));
    if (!doc) return null;
    for (const [k, v] of Object.entries(patch)) {
      if (k === '$inc') {
        for (const [ik, iv] of Object.entries(v)) doc[ik] = (Number(doc[ik]) || 0) + Number(iv);
      } else if (k === '$set') {
        Object.assign(doc, v);
      } else if (!k.startsWith('$')) {
        doc[k] = v;
      }
    }
    doc.updatedAt = new Date().toISOString();
    return clone(doc);
  }

  async deleteOne(filter) {
    const idx = this.docs.findIndex((d) => matches(d, filter));
    if (idx >= 0) this.docs.splice(idx, 1);
    return true;
  }

  async deleteMany(filter = {}) {
    const keep = this.docs.filter((d) => !matches(d, filter));
    this.docs.length = 0;
    this.docs.push(...keep);
    return true;
  }

  async count(filter = {}) {
    return this.docs.filter((d) => matches(d, filter)).length;
  }
}

function connect() {
  // fresh store on boot (demo mode)
  store.clear();
}

function collection(name) {
  return new MemCollection(name);
}

module.exports = { connect, collection };
