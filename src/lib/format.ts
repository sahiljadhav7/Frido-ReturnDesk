const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
// en-US for 'Sep' (en-GB/en-IN say 'Sept'); day-month-year order is assembled below.
const day = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

export const formatPaise = (paise: number) => inr.format(paise / 100);

/** `28 Sep 2026`, in Asia/Kolkata whatever the server's zone. */
export const formatDay = (at: string | Date) => {
  const p = Object.fromEntries(day.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month} ${p.year}`;
};
