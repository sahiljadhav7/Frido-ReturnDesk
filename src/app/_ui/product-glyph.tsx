import { Icon } from './icons';

export function ProductGlyph({ className = 'flex' }: { className?: string }) {
  return (
    <span className={`size-12 shrink-0 items-center justify-center rounded-[14px] border border-hair bg-white text-in-review-ink ${className}`} aria-hidden>
      <Icon name="box" />
    </span>
  );
}
