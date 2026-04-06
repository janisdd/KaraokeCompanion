# Cookie handling

The app currently uses two separate session cookies.

- User session: managed through the built-in user session helpers used by `server/api/users/login.get.ts` and `server/api/users/logout.post.ts`. This stores which user is currently active in the browser session.
- Admin session: managed separately in `server/utils/adminSession.ts` and used by `server/api/admin/login.post.ts`, `server/api/admin/logout.post.ts`, and the admin API middleware. This stores whether the browser is currently authenticated for admin actions.

These two states are intentionally separate. A browser can be authenticated for admin actions without being logged in as a user, and it can be logged in as a user without having admin access.
