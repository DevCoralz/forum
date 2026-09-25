export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5" aria-label="I2P Forum home">
      <span className="brand-mark" aria-hidden="true">I2P</span>
      {!compact && <span className="font-display text-[1.05rem] font-bold text-foreground">I2P <b className="text-primary">Forum</b></span>}
    </div>
  );
}