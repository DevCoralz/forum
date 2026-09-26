export function BrandMark({ name = "I2P Forum" }: { name?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <div className="flex items-center gap-2.5" aria-label={`${name} home`}>
      <span className="brand-mark" aria-hidden="true">I2P</span>
      <span className="font-display text-[1.05rem] font-bold text-foreground">
        <span className="brand-red">{first}</span>
        {rest.length > 0 && <> <b className="text-primary">{rest.join(" ")}</b></>}
      </span>
    </div>
  );
}
