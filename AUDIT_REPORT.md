# Repository audit (read-only baseline)

Audit performed before implementation on 2026-10-06. This records behavior observed in source; a component or route is not treated as proof that its end-to-end behavior works.

## A. Architecture

- Single React 19/Vite SPA under `client/`, styled with Tailwind 4 plus a large custom `index.css`; React Router v7 handles pages.
- Express 4 ESM API under `server/`, MongoDB/Mongoose models with a JSON/memory fallback in `server/src/services/store.js`.
- Firebase Web SDK performs Google popup sign-in; backend then issues a JWT in an HttpOnly cookie and also returns it for browser localStorage/Bearer use.
- Cloudinary is used from the backend. Socket.IO provides online presence, admin monitoring and game/leaderboard events.
- Root package is a small deployment wrapper; client and server have independent manifests and lockfiles.

## B. Existing features / flow status

- Login UI, profile onboarding, dashboard, profile, team page, rounds, leaderboard, help/resources/announcements, game UI, and extensive admin panel exist.
- Admin APIs for users, teams, rounds, puzzle CRUD/order/publish, leaderboard control, whitelist, FAQs, audit logs, and live state exist and most admin routers apply backend role middleware.
- Team create/join/read/leave and roster display are connected to the API. Team size is capped in the route only up to 10; the default is 3, so the event maximum is not enforced. Minimum readiness is two.
- Round 1 has state/start/submit APIs and a team session model. The round's game API is connected to `PuzzleGamePage`, but the board's tile arrangement does not reach the backend: the UI submits a text `answer`, and the API compares it with `Puzzle.solution`.
- Admin puzzle UI writes image URLs and a text solution. The server upload endpoint uploads the original image, while crop section generation returns Cloudinary URL transformations or synthetic query parameters. No image bytes are sliced, no piece IDs/correct order are stored, and participant pieces are not shuffled/validated as IDs.
- Rounds 2–4 have generic session/challenge paths. Their completion and qualification logic is distinct from the requested Round 1 image puzzle path.
- Socket.IO authenticates opportunistically and emits team/admin events. Live monitoring computes a fixed 30-minute timer independently of round/session configuration.

## C. Backend / database / API findings

- `connectDB()` silently falls back after Mongo errors; `store.js` often catches database errors and continues against memory/disk. In production this can report successful writes that disappear on restart or are not visible to other instances.
- A Mongo URI, Cloudinary API key/secret, JWT fallback secrets, Firebase web config, and hard-coded admin email values exist in source. JWT fallback secrets differ between HTTP and Socket.IO.
- Google auth does not verify `firebaseToken`; it trusts client-supplied email/UID/name. In development, `devUser` can choose an arbitrary email, including a whitelisted admin. Role promotion is based on email and the whitelist is seeded in source.
- JWT has no required production secret check. Auth errors expose `error.message`. Several endpoints return raw exception messages.
- CORS accepts every origin despite credentials being enabled. JSON payload allowance is 10 MB; image route accepts remote URLs/base64 without strict content inspection. Upload route allows any authenticated account and arbitrary Cloudinary folder.
- `requireAuth` user identity is sourced from JWT and loaded from storage, but team membership is not checked against `team.memberIds` in Round 1; request `user.teamId` is trusted. Leader checks also accept any account whose role is `team_leader`, even if not the team's recorded leader.
- Team create/join/leave mutations are not atomic. `joinTeam()` omits capacity / existing-team enforcement internally and the database branch can race; leader role/team associations can become inconsistent. Leaving the leader reassigns leader without reliably updating all stores. Admin member removal does not validate that the user belongs to the supplied team ID.
- Round 1 session has no `expiresAt`, is found only among `IN_PROGRESS` sessions, and creation is not protected by a unique team/round active-session index or transaction. Session start is repeatable but returns an existing active session. Submission trusts browser `timeSpentSeconds`; timer is not server-enforced.
- Submission picks a puzzle by `currentPuzzleIndex` rather than validating `currentPuzzleId`, does not enforce current round status beyond `LOCKED`, and errors often become 500s. Failed DB save is swallowed. Puzzle attempts store text answers, not piece ordering.
- Puzzle schema lacks source public ID, piece IDs, original indices, and correct order. `toPublicJSON()` is not consistently used; game state avoids `solution` manually, but admin list endpoints expose the solution field to admins by design. Puzzle publish accepts arbitrary payload coercion; malformed puzzle publication is not prevented.
- Image validation trusts client-supplied MIME/size fields; grid bounds and dimensions are weakly validated. Piece generation uses URL math (`fl_relative` percentages) rather than deterministic raster crops. No upload rollback or cleanup occurs on partial failures.
- Admin `reorderPuzzles` accepts any IDs/order values and does not validate round membership. Puzzle CRUD/save catches DB errors and falls back to local JSON, creating split-brain behavior.
- Profiles validate required presence only (not lengths/formats/uniqueness). Registration/roll values have no uniqueness constraint. User and admin payloads can include broad Mongoose/user fields.
- Global error middleware can expose messages. Several routes concatenate raw errors into client responses.

## D. Frontend / state findings

- `apiFetch` stores JWT in localStorage and sends Bearer and cookies; XSS exposure is therefore material. It has no common timeout/response parsing/error normalization.
- Firebase web settings are hard-coded as defaults. `AuthContext` offers a dev login function, although LoginPage currently exposes Google-only UI.
- `LoginPage` navigates during render for an existing user. Firebase config analytics initialization is asynchronous and failure is swallowed.
- `PuzzleGamePage` hardcodes a 9-slot board and 3-column layout regardless of puzzle rows/columns, creates a random visual shuffle client-side, shows the source-coordinate order to users through `processedSections` ordering/labels, does not submit that arrangement, and uses an elapsed browser timer reset on load. Members are visually read-only but APIs have the authorization weaknesses described above.
- Admin puzzle creation takes a URL/text passcode rather than a file upload/generate/verify workflow. “Preview slicing” is a static text and UI currently claims nine sections regardless of selected grid.
- AdminDashboardPage is a large multipurpose component (2,200+ lines) spanning all admin functions. Puzzle order uses drag-and-drop and buttons. Existing consumers align with `/api/v1/admin/mgmt/puzzles` routes.
- Error and loading handling is inconsistent; much of the UI reads JSON without handling non-JSON/network responses centrally.

## E. Security, runtime, deployment, dependencies

- Confirmed authentication bypass and secret exposure findings above are production blockers. Admin role assignment also permits an admin to promote users to `super_admin` through the role API without a second-person/last-admin guard.
- Socket guest access is allowed for public room, which is reasonable for public leaderboard notifications, but token verification uses a different fallback JWT secret and invalid tokens downgrade silently to guest. `team_*` rooms are chosen from user profile fields.
- Socket CORS also permits all origins. Client socket code caches the first token; token changes do not update an existing connection.
- Root `build` only runs `npm install --prefix server`, not the frontend build. Root Vercel rewrites all paths to SPA; no serverless API mapping is present. Client Vercel config also rewrites to SPA. Deployment environment variables and server process topology need explicit configuration.
- Vite 8 / plugin-react 6 / React 19 / Tailwind 4 are recent but consistently declared in the client lockfile; no arbitrary upgrades are warranted. Root/server Express/Mongoose/Socket versions align. Root and server duplicate backend dependency declarations. No test scripts or test files are present. No Sharp/Jimp/image library is installed.
- ESM is consistently declared for app code. Backend startup calls DB connect without awaiting it, then begins accepting requests. The store backup files are duplicated (`server/data/db_store.json` and `server/server/data/db_store.json`); actual path depends on process working directory.

## F. Initial change plan

Preserve React/Express/Mongoose/Firebase/Cloudinary/Socket.IO and existing route conventions. First restore verified identity and fail-closed production configuration; then implement the Round 1 image-piece data/processing and leader/team/session checks in existing models/routes/services; finally adapt existing admin and participant screens to those contracts. Existing non-Round-1 routes and unrelated UI should remain intact.

## G. Baseline validation inventory

- No tests found in the repository inventory.
- Existing dependencies have not been installed or upgraded as part of this read-only audit.
- Build/runtime behavior remains to be checked after the implementation stage.

## H. Implemented changes

- Kept the React/Vite/Tailwind client and Express/Mongoose/Socket.IO server. Updated existing routes, models, and screens rather than adding a second puzzle subsystem.
- Added server-side Firebase ID-token verification (Google provider required), shared JWT configuration, HttpOnly-cookie client requests, strict origin allowlisting, production configuration checks, sanitized server errors, and admin-only upload/puzzle management. Production now fails startup without its required MongoDB, Cloudinary, Firebase, origin, and JWT configuration.
- Enforced exact team membership and recorded team-leader identity for Round 1. Teams are limited to three members; database joins enforce the cap atomically. Session creation/submission checks active round, team, leader, current puzzle, and server-side expiration.
- Added deterministic Sharp raster slicing for validated JPEG/PNG/WebP uploads (maximum 5 MB; 2–8 rows/columns). The processor uploads source and pieces to Cloudinary, rolls back uploaded assets on processing/upload failure, and persists opaque piece IDs, row/column/index, URLs, Cloudinary public IDs, and server-only correct order.
- The existing admin puzzle panel now generates a persisted draft and previews source/pieces/IDs before publish. Publish checks the puzzle structure; puzzle sequence is validated and stored by sequence number. Existing text puzzle fields remain for other round compatibility.
- Round 1 game state returns shuffled pieces without order/index/correct-order metadata. Submission accepts only the piece ID order; the backend checks exact membership, duplicates, omissions, current puzzle, and stored order. Correct submissions alone earn points and advance the server-held sequence. Session start/expiry/progress/score are stored against the team; a background sweep expires due sessions.
- Added profile username support, updated audit-log target validation, removed source hard-coded server credentials/admin allowlist, and provided environment examples. Existing legacy malformed published Round 1 puzzles are unpublished on startup so they cannot enter the new flow.

## I. Files changed/added

- Changed the existing client auth/API/socket integration, admin puzzle UI, and participant puzzle UI.
- Changed existing server auth/config, team/user/admin/upload/round/game routes, models, store, image processing service, and server startup. Added `server/src/config/env.js`, `server/src/config/firebaseAdmin.js`, and `server/src/config/jwt.js`.
- Added `client/.env.example`, `server/.env.example`, and this report. No source files were removed.
- Existing `client/package.json` and its lockfile were already modified at audit start; those user changes were preserved. The server dependencies now include `firebase-admin` and `sharp`, with lockfile updates. Root build now builds both client and server.

## J. Final verification and remaining work

- `npm run build` passed: Vite production build and backend `node --check` build completed. Vite reports the existing single JS bundle is 577.57 kB minified (over its 500 kB warning threshold).
- `npm run lint --prefix client` exited 0. It reports existing unused imports/variables and React effect/purity warnings, including warnings in the changed admin and puzzle screens; these are not build failures and were not broadly cleaned up to avoid unrelated UI churn.
- `node --check` passed for every `server/src/**/*.js` file.
- Local health check returned HTTP 200 from the server already bound to port 5000. That process is an older process and prevented a second server from binding (EADDRINUSE); it must be restarted/redeployed to load these changes. It was left running.
- No automated test suite exists in the repository. The complete Google/Firebase → Cloudinary → MongoDB → browser → socket happy-path and malicious-request matrix has not been exercised end-to-end with real credentials and a browser. Build/syntax/health checks are not a substitute for that acceptance run. Cloudinary upload rollback, competing multi-instance writes, all Round 2–4 regressions, and qualification policy should receive staging verification before event production.
- `npm install` reported two moderate dependency audit findings; dependency upgrades were not applied as part of this work. Run a reviewed dependency audit/remediation before deployment.
- The Firebase web configuration is still exposed to the browser by design and is configurable from `VITE_FIREBASE_*`; restrict its API key by allowed referrers and enabled APIs in Firebase/Google Cloud. It is not a server credential. Do not put service-account JSON or Cloudinary secrets in client variables.
- Required production server environment: `MONGO_URI`, `JWT_SECRET` (at least 32 characters), `CLIENT_ORIGIN` (comma-separated exact origins), `FIREBASE_PROJECT_ID` plus `FIREBASE_SERVICE_ACCOUNT_JSON` or ADC, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`; optionally set `ADMIN_EMAILS` and `JWT_EXPIRES_IN`. Client configuration is `VITE_API_BASE_URL` plus the Firebase `VITE_FIREBASE_*` web-app settings. `DEV_AUTH_ENABLED` is for local development only.
- Production still depends on an actual MongoDB/Cloudinary/Firebase staging configuration and a client/server deployment topology that routes `/api/v1` to Express. The existing Vercel SPA rewrite alone does not deploy the Express API.
