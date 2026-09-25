export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="CORALZ home">
      <span className="brand-mark" aria-hidden="true"><span /></span>
      {!compact && <span className="font-display text-[1.05rem] font-semibold text-foreground">Coralz</span>}
    </div>
  );
}