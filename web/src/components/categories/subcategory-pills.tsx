import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import type { Subcategory } from "@/services/mappers";

const PAGE = 20;
/** Transparent pills with the subcategory's icon + name, five per row. */
export function SubcategoryPills({
  subcategories,
  categoryId,
}: {
  subcategories: Subcategory[];
  categoryId: string;
}) {
  const [shown, setShown] = useState(PAGE);
  const visible = useMemo(() => subcategories.slice(0, shown), [subcategories, shown]);
  if (!subcategories.length) return null;

  return (
    <section className="subcat-section" aria-label="Subcategories">
      <div className="subcat-grid">
        {visible.map((sub) => (
          <Link
            key={sub.id}
            to="/category/$categoryId"
            params={{ categoryId }}
            search={{ sub: sub.id }}
            className="subcat-pill"
          >
            {sub.iconUrl ? (
              <img src={sub.iconUrl} alt="" className="subcat-pill-icon" loading="lazy" />
            ) : (
              <span className="subcat-pill-dot" aria-hidden />
            )}
            <span className="subcat-pill-name">{sub.name}</span>
          </Link>
        ))}
      </div>
      {subcategories.length > shown && (
        <button
          type="button"
          className="subcat-more"
          onClick={() => setShown((n) => n + PAGE)}
        >
          See more <ChevronDown size={13} aria-hidden />
        </button>
      )}
    </section>
  );
}
