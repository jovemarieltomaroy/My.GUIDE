export function getPeriodRange(period, customStart, customEnd, now = new Date()) {

  if (period === 'custom') return {
    start: customStart ? new Date(`${customStart}T00:00:00+08:00`) : null,
    end: customEnd ? new Date(new Date(`${customEnd}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000) : null,
  };

  const todayInManila = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const end = new Date(new Date(`${todayInManila}T00:00:00+08:00`).getTime() + 24 * 60 * 60 * 1000);

  if (period === "all-time") {
    return {
      start: null,
      end,
    };
  }

  if (
    period === "current-year"
  ) {
    return {
      start: new Date(`${todayInManila.slice(0, 4)}-01-01T00:00:00+08:00`),
      end,
    };
  }

  const months =
    period === "6-months"
      ? 6
      : 12;

  const firstMonth = new Date(Date.UTC(Number(todayInManila.slice(0, 4)), Number(todayInManila.slice(5, 7)) - months, 1));
  const monthStart = new Date(`${firstMonth.toISOString().slice(0, 10)}T00:00:00+08:00`);
  return { start: monthStart, end };
}

