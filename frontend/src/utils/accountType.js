export function getAccountType(user) {
  if (['household', 'commercial', 'service'].includes(user?.accountType)) return user.accountType;
  if (user?.household?.kitchenType === 'commercial') return 'commercial';
  if (user?.household?.kitchenType === 'hostel') return 'service';
  return 'household';
}

export function isHousehold(user) {
  return getAccountType(user) === 'household';
}
