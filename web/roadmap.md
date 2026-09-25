# I2P Forum — connect frontend to live backend

Live API: https://api-forum.coralz.de5.net/api/v1 (FastAPI, cookie session + bearer token)
Status: services layer done (src/services: api, auth, posts, profiles, messages, mappers).

## Tasks
- [x] Auth context + `useAuth` hook wired to /auth/login, /auth/register, /auth/me, /auth/logout
- [x] Wire site header, login/signup pages to auth
- [x] Wire home feed + categories (GET /posts, /posts/categories)
- [x] Wire post detail: content gating, comments, like (POST /posts/{id}/like)
- [x] Wire write page (POST /posts)
- [x] Wire profile page (GET /profiles/{username}, author posts)
- [x] Wire settings page (PATCH /me/profile, /me/privacy, /me/sessions, /me/subscription, avatar upload)
- [x] Wire messages page to chat + DMs (endpoints were missing; see backend/)
- [x] Same-origin proxy at /api/proxy (live API CORS rejects the preview origin for now)
- [x] Backend code written at backend/ (user deploys it): chat stream, DM threads,
      users/search, follow toggle, DELETE /posts/{id}, GET /me/privacy + extended
      fields, per-category post_count, PATCH /me/profile username support
- [ ] Backend bugs for the user to fix when deploying:
      - GET /profiles/{username} returns 500 (profile page can't load)
      - CORS_ORIGINS must include the preview/production domains (then drop the proxy)
      - session cookie needs SameSite=None; Secure for cross-origin
      - GET /auth/change-password returns 405? — verify change-password route
- [x] Verify end-to-end with Playwright using the lovable_qa test account on the live API
      (login/home/settings verified; messages blocked until chat endpoints deploy; profile page
      blocked by the backend 500; post feed empty because the backend has no posts yet)
- [x] Fixed: login form didn't update the auth context — header showed "Login" until reload
      (auth-form now signs in through useAuth)
- [x] Rename the product to I2P Forum and replace the blue promotional design with the selected gold-led cyber-noir forum system
- [x] Replace the hero with a direct forum index, use a vertical page-list menu, and simplify profiles

## Post access (done)
- [x] Lists (home, profile, similar) are title-only — server sends no excerpt/content
- [x] Detail: guests → login lock; free members → unlock after like + comment; premium post → premium only; premium/author/admin see immediately (server returns `lock_reason`)

## Free-tier rules (done Sep 2026)
- [x] Every registration is created with role `free` (explicit in auth_service.register); admin/super_admin unaffected
- [x] Lists show the title only; the title is a plain anchor (no underline) that does a full browser navigation to /post/{id}
- [x] Like and comment trigger a full page reload so unlocked content appears immediately
- [x] Free members must like AND comment before the body is revealed (server `lock_reason: interact`)
- [x] Premium posts show "Upgrade To Premium to view Premium Posts" blockade in feed rows, the Premium/All tabs and the detail page

## Reliability and state cleanup (in progress Sep 2026)
- [x] Prevent transient first-request failures on page navigation
- [x] Wait for successful like/comment responses, then refresh post data
- [x] Use circular-only loading indicators across all pages
- [x] Shorten all empty states and remove dash-separated explanations
- [x] Change the interaction bypass message
- [x] Verify and package the full updated project
