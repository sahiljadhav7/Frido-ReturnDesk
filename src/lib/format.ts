const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export const formatPaise = (paise: number) => inr.format(paise / 100);
