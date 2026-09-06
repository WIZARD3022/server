const models = require('../models');

const clean = value => {
  if (!value) return value;
  const result = value && typeof value.toObject === 'function' ? value.toObject({ getters: true }) : { ...value };
  if (result._id !== undefined) { result.id = String(result._id); delete result._id; }
  return result;
};
const mapWhere = where => {
  if (!where) return {};
  const out = {};
  if (where.OR) out.$or = where.OR.map(mapWhere);
  if (where.AND) out.$and = where.AND.map(mapWhere);

  Object.keys(where).forEach(key => {
    if (key === 'OR' || key === 'AND') return;
    let value = where[key];

    let targetKey = key === 'id' ? '_id' : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const mongoFilter = {};
      if (value.in !== undefined) mongoFilter.$in = value.in;
      if (value.notIn !== undefined) mongoFilter.$nin = value.notIn;
      if (value.contains !== undefined) {
        mongoFilter.$regex = value.contains;
        if (value.mode === 'insensitive') mongoFilter.$options = 'i';
      }
      if (value.gt !== undefined) mongoFilter.$gt = value.gt;
      if (value.gte !== undefined) mongoFilter.$gte = value.gte;
      if (value.lt !== undefined) mongoFilter.$lt = value.lt;
      if (value.lte !== undefined) mongoFilter.$lte = value.lte;
      if (value.not !== undefined) mongoFilter.$ne = value.not;

      if (Object.keys(mongoFilter).length > 0) {
        out[targetKey] = mongoFilter;
      } else {
        out[targetKey] = value;
      }
    } else {
      out[targetKey] = value;
    }
  });
  return out;
};
const project = (doc, select) => {
  const value = clean(doc);
  if (!value) return value;
  if (!select) return value;
  const result = {};
  Object.keys(select).forEach(k => { if (select[k]) result[k] = value[k]; });
  if (result.id === undefined) result.id = value.id;
  return result;
};
const wrap = name => {
  const Model = models[name];
  return {
    findMany: async ({ where, orderBy, take, select } = {}) => {
      let q = Model.find(mapWhere(where));
      if (orderBy) Object.keys(orderBy).forEach(k => q = q.sort({ [k]: orderBy[k] === 'desc' ? -1 : 1 }));
      if (take) q = q.limit(take);
      return (await q.lean()).map(x => project(x, select));
    },
    findFirst: async ({ where, select } = {}) => {
      let q = Model.findOne(mapWhere(where));
      return project(await q.lean(), select);
    },
    findUnique: async ({ where, select } = {}) => {
      const criteria = where && where.id ? { _id: where.id } : mapWhere(where);
      let q = Model.findOne(criteria);
      return project(await q.lean(), select);
    },
    count: async ({ where } = {}) => Model.countDocuments(mapWhere(where)),
    aggregate: async ({ where, _sum } = {}) => {
      const field = _sum && Object.keys(_sum)[0];
      const rows = await Model.find(mapWhere(where)).lean();
      return { _sum: { [field]: rows.reduce((sum, row) => sum + Number(row[field] || 0), 0) } };
    },
    create: async ({ data }) => {
      const payload = { ...(data || {}) };
      if (payload.id !== undefined && payload._id === undefined) { payload._id = payload.id; delete payload.id; }
      return clean(await new Model(payload).save());
    },
    update: async ({ where, data }) => {
      const update = {};
      Object.keys(data || {}).forEach(k => {
        const v = data[k];
        if (v && typeof v === 'object' && (v.increment !== undefined || v.decrement !== undefined)) update.$inc = { ...(update.$inc || {}), [k]: v.increment !== undefined ? v.increment : -v.decrement };
        else if (v !== undefined) update.$set = { ...(update.$set || {}), [k]: v };
      });
      return clean(await Model.findOneAndUpdate(mapWhere(where), update, { new: true, runValidators: true }).lean());
    },
    delete: async ({ where }) => Model.findOneAndDelete(mapWhere(where)),
    deleteMany: async ({ where }) => Model.deleteMany(mapWhere(where)),
    updateMany: async ({ where, data }) => Model.updateMany(mapWhere(where), { $set: data || {} })
  };
};
const db = {};
Object.keys(models).forEach(name => { db[name.charAt(0).toLowerCase() + name.slice(1)] = wrap(name); });
db.$transaction = async operation => Array.isArray(operation) ? Promise.all(operation) : operation(db);
module.exports = db;
