export function getAccountType(user) {
  const savedType = String(user?.accountType || '').trim().toLowerCase();
  const businessType = String(user?.businessProfile?.businessType || '').trim().toLowerCase();
  if (['pg', 'hostel', 'pg/hostel', 'pg-dibbewala', 'pg/dibbewala'].includes(savedType)) return 'service';
  if (['pg', 'hostel', 'pg/hostel'].includes(businessType)) return 'service';
  if (['household', 'commercial', 'service'].includes(user?.accountType)) return user.accountType;
  if (['tiffin', 'dibbewala'].includes(savedType) || ['tiffin', 'dibbewala'].includes(businessType)) return 'service';
  if (user?.household?.kitchenType === 'commercial') return 'commercial';
  if (user?.household?.kitchenType === 'hostel') return 'service';
  return 'household';
}

export function isPgAccount(user) {
  if (getAccountType(user) !== 'service') return false;
  const accountType = String(user?.accountType || '').trim().toLowerCase();
  const businessType = String(user?.businessProfile?.businessType || '').trim().toLowerCase();
  if (['pg', 'hostel', 'pg/hostel', 'pg-dibbewala', 'pg/dibbewala'].includes(accountType)) return true;
  if (['tiffin', 'dibbewala'].includes(accountType)) return false;
  if (businessType) return ['pg', 'hostel', 'pg/hostel'].includes(businessType);
  return user?.household?.kitchenType === 'hostel';
}

export function isHousehold(user) {
  return getAccountType(user) === 'household';
}
