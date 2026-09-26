<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the I2P Forum visual system globally: matte navy, gold-led accents, selective crimson, Libre Baskerville headings, and IBM Plex Sans body; this keeps every page consistent with the chosen forum direction.
- Never use native browser `alert`/`confirm`/`prompt`; all dialogs use the themed Radix Dialog/ConfirmDialog/PromptDialog components — the owner requires a consistent look.
- Admin action buttons show their own circular spinner while their request is in flight (per-action busy keys), never a frozen full-page state.
- The verified tick is a blue badge with a white check (`VerifiedBadge` component), never the default cyan icon.
- One admin "Site image" upload feeds the logo, favicon, and social preview (written to all three settings keys for backward compatibility).
- The `api/` folder holds the owner-deployed FastAPI backend; the frontend talks to it via `VITE_API_URL` — keep both in every export.
