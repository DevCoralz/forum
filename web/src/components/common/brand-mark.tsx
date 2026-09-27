import { assetUrl } from "@/services/api";

interface BrandMarkProps {
  name?: string;
  logoUrl?: string | null;
}

export function BrandMark({ name = "I2P Forum", logoUrl }: BrandMarkProps) {
  const [first, ...rest] = name.split(" ");
  const resolvedLogo = assetUrl(logoUrl ?? undefined);

  return (
    <div className="flex items-center gap-2.5" aria-label={`${name} home`}>
      {resolvedLogo ? (
        <img
          src={resolvedLogo}
          alt={name}
          className="h-8 w-auto max-w-[9rem] object-contain"
          // The uploaded image is the brand mark now — never fall through to
          // stale alt text or a broken-image icon if the media 404s.
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="brand-mark" aria-hidden="true">I2P</span>
      )}
      <span className="font-display text-[1.05rem] font-bold text-foreground">
        <span className="brand-red">{first}</span>
        {rest.length > 0 && <> <b className="text-primary">{rest.join(" ")}</b></>}
      </span>
    </div>
  );
}
