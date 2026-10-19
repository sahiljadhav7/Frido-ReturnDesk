// A white card seated in a hairline tray (ui.md "Shells and cards").
export function Shell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-shell border border-hair bg-[rgba(16,24,32,0.035)] p-1.5 ${className}`}>
      <div className="rounded-card bg-white p-5 shadow-card sm:p-6">{children}</div>
    </section>
  );
}
