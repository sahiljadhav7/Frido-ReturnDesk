// Six fixed tints; a hash of the email picks one, so a customer keeps their colour.
const tints = [
  'bg-[#fff6d1] text-[#6e5a1f]',
  'bg-[#eaf2fc] text-[#1d4d8a]',
  'bg-[#dcf7dd] text-[#075b08]',
  'bg-[#ffe9e8] text-[#9f130b]',
  'bg-[#f1e8fb] text-[#5b2a86]',
  'bg-[#e3f4f4] text-[#1c5c5c]',
];

export function Avatar({ name, email }: { name: string; email: string }) {
  const hash = [...email].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return (
    <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tints[hash % tints.length]}`} aria-hidden>
      {initials}
    </span>
  );
}
