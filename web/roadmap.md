# Coralz Forum — connect frontend to live backend

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
- [ ] After this: user has frontend design changes queued (ask what they are)
