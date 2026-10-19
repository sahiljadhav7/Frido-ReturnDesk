// Inline SVG icons: 1.5px stroke, round caps, 18px (ui.md "Icons").
const paths = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  back: 'M14.5 6l-6 6 6 6',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5.5M12 16.2v.3',
  minus: 'M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  chevron: 'M6 9.5l6 6 6-6',
  right: 'M9.5 6l6 6-6 6',
  sort: 'M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  note: 'M5 5h14v10H10l-4 4v-4H5z',
};

export function Icon({ name, className = 'size-[18px]' }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
