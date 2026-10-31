/** Date helpers - all dates are 'YYYY-MM-DD' ISO day strings (lexicographically sortable) */

function todayISO() {
  const d = new Date();
  return toISO(d);
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Whole days from today until the given date (negative = past) */
function daysUntil(iso) {
  if (!iso) return null;
  const today = new Date(todayISO() + 'T00:00:00');
  const then = new Date(iso + 'T00:00:00');
  return Math.round((then - today) / 86400000);
}

/** Monday of the current week (optionally offset by N weeks) */
function weekStartISO(offset = 0) {
  const d = new Date();
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  return toISO(d);
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayLabel(iso) {
  return DAY_LABELS[new Date(iso + 'T00:00:00').getDay()];
}

module.exports = { todayISO, addDaysISO, daysUntil, weekStartISO, dayLabel, toISO };
