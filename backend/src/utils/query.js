function parsePagination(query, defaultLimit = 10) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Mengubah date_from/date_to (YYYY-MM-DD) menjadi filter Prisma {gte, lt}
function dateRange(from, to) {
  const range = {};
  if (from) {
    const d = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(d.getTime())) range.gte = d;
  }
  if (to) {
    const d = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + 1);
      range.lt = d;
    }
  }
  return Object.keys(range).length ? range : null;
}

module.exports = { parsePagination, dateRange };
