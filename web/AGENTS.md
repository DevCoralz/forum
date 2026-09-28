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

# Architecture decisions

- **No client-token handshake.** The Python API answers requests based on the CORS origin allowlist only; every protected endpoint still requires a real login JWT. Why: the signed-token handshake broke whenever the frontend restarted, and it blocked settings saves while public endpoints kept working.
- **Tools-only composer.** The write page creates tools only (no forum threads); the public profile page, private DMs, user search/follow, and comment posting are removed in both frontend and API. Why: the product is a tool marketplace, not a forum.
- **Profiles are private.** GET /profiles/{username} only returns the caller's own profile. Why: the user wants no public profile browsing.
- **Never hardcode site identity.** Site name/description/footer come from the admin-managed settings (public `/site` bootstrap); "Coralz" strings are fallbacks only. Why: the admin settings must control everything visible.
- **Bright Royal Glass theme.** Light background with color glows, glass surfaces, pill shapes; Sora + Manrope; five royal accents defined as tokens in src/styles.css. Never introduce dark themes or hardcoded color utilities.
