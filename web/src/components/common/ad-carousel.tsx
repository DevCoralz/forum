import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { assetUrl } from "@/services/api";
import type { AdSlide } from "@/types/admin";

const IMAGE_SLIDE_MS = 6_000;

/** Ad banner shown above the feed: 2–5 slides, auto-advance, videos advance when
 * they finish, loops back to the first slide. Nothing renders without ads. */
export function AdCarousel({ ads }: { ads: AdSlide[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const next = useCallback(() => {
    setIndex((current) => (current + 1) % ads.length);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const current = ads[index];
    if (current?.media_type === "video") return; // video advances itself on end
    const timer = window.setInterval(next, IMAGE_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [ads, index, next]);

  if (ads.length === 0) return null;

  return (
    <section
      className="ad-carousel mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8"
      aria-label="Sponsored"
      onTouchStart={(event) => { touchStartX.current = event.touches[0]!.clientX; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null || ads.length < 2) return;
        const delta = event.changedTouches[0]!.clientX - touchStartX.current;
        if (Math.abs(delta) > 40) {
          setIndex((current) =>
            delta < 0 ? (current + 1) % ads.length : (current - 1 + ads.length) % ads.length);
        }
        touchStartX.current = null;
      }}
    >
      <div className="ad-frame">
        {ads.map((ad, position) => {
          const src = assetUrl(ad.media_url);
          if (!src) return null;
          const active = position === index;
          return (
            <div key={ad.id} className="ad-slide" data-active={active} aria-hidden={!active}>
              {ad.media_type === "video" ? (
                <video
                  src={src}
                  autoPlay={active}
                  muted
                  playsInline
                  onEnded={next}
                  preload={active ? "auto" : "none"}
                />
              ) : (
                <img src={src} alt={ad.description || "Advertisement"} loading={position === 0 ? "eager" : "lazy"} />
              )}
              <div className="ad-caption">
                <span className="min-w-0 truncate">{ad.description}</span>
                {ad.url && (
                  <a href={ad.url} target="_blank" rel="noopener noreferrer nofollow" className="ad-visit">
                    Visit <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {ads.length > 1 && (
        <div className="ad-dots" role="tablist" aria-label="Ad slides">
          {ads.map((ad, position) => (
            <button
              key={ad.id}
              role="tab"
              aria-selected={position === index}
              aria-label={`Ad ${position + 1}`}
              className={position === index ? "active" : ""}
              onClick={() => setIndex(position)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
