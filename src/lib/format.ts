const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
// en-US for 'Sep' (en-GB/en-IN say 'Sept'); day-month-year order is assembled below.
const parts = new Intl.DateTimeFormat('en-US', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kolkata',
});
const kolkata = (at: string | Date) => Object.fromEntries(parts.formatToParts(new Date(at)).map((x) => [x.type, x.value]));

export const formatPaise = (paise: number) => inr.format(paise / 100);

/** `28 Sep 2026`, in Asia/Kolkata whatever the server's zone. */
export const formatDay = (at: string | Date) => {
  const p = kolkata(at);
  return `${p.day} ${p.month} ${p.year}`;
};

/** `17 Oct 2026, 14:05`, or `17 Oct, 14:05` without the year (list and timeline). */
export const formatDateTime = (at: string | Date, { year = true } = {}) => {
  const p = kolkata(at);
  return `${p.day} ${p.month}${year ? ` ${p.year}` : ''}, ${p.hour}:${p.minute}`;
};
