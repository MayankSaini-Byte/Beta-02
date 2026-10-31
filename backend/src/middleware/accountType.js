const { asyncH, httpError } = require('./errors');

function resolveAccountType(user) {
  if (['household', 'commercial', 'service'].includes(user?.accountType)) return user.accountType;
  if (user?.household?.kitchenType === 'commercial') return 'commercial';
  if (user?.household?.kitchenType === 'hostel') return 'service';
  return 'household';
}

function requireAccountType(...allowedTypes) {
  return asyncH(async (req, res, next) => {
    const user = await req.db.col('users').findOne({ _id: req.userId });
    if (!user) throw httpError(401, 'User not found');
    if (!allowedTypes.includes(resolveAccountType(user))) throw httpError(403, 'This feature is not available for this workspace type');
    req.accountUser = user;
    next();
  });
}

module.exports = { resolveAccountType, requireAccountType };
