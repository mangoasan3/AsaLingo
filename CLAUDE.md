# CLAUDE.md

## Project overview

AsaLingo is a mobile-first vocabulary learning platform with:
- email/password auth
- Google OAuth
- user onboarding with CEFR level selection
- vocabulary discovery and saving
- practice sessions and progress tracking
- AI-assisted explanations, examples, quizzes, and similar words

This repository is split into:
- `frontend/` — React + TypeScript + Vite app
- `backend/` — Express + TypeScript + Mongoose API
- `docker-compose.yml` — local full-stack environment with MongoDB 7

Important: the current codebase uses **DeepSeek**, not Anthropic Claude, for AI features.
- package: built-in `fetch` (no provider SDK)
- env var: `DEEPSEEK_API_KEY`
- model: `deepseek-chat`

---

## Stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router
- TanStack Query
- Zustand (persisted auth store)
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express
- TypeScript
- Mongoose ODM
- MongoDB 7
- Passport Google OAuth
- JWT auth with refresh token rotation
- Express Validator
- Winston logger

### Infrastructure
- Docker
- Docker Compose

---

## Repository structure

```txt
AsaLingo/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   └── passport.ts
│   │   ├── db/
│   │   │   └── mongoose.ts
│   │   ├── middleware/
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── RefreshToken.ts
│   │   │   ├── VocabularyWord.ts
│   │   │   ├── UserWord.ts
│   │   │   ├── LearningSession.ts
│   │   │   ├── AIContentCache.ts
│   │   │   └── index.ts
│   │   ├── modules/
│   │   │   ├── ai/
│   │   │   ├── auth/
│   │   │   ├── practice/
│   │   │   ├── users/
│   │   │   └── words/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── seed.ts
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── i18n/              # 10 locales: en (default), ru, es, fr, de, it, pt, ja, ko, zh
│   │   ├── pages/
│   │   ├── store/             # authStore, localeStore (both Zustand + persist)
│   │   ├── types/
│   │   ├── utils/             # language.ts, word.ts, wordMeaning.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## How to run

### Docker first

Preferred local setup:

```bash
cp .env.example .env
docker-compose up --build
```

Then seed the database:

```bash
docker-compose exec backend npm run db:seed
```

App URLs:
- frontend: `http://localhost:5173`
- backend API: `http://localhost:4000/api`
- backend health: `http://localhost:4000/health`

### Local dev without Docker

Backend:

```bash
cd backend
npm install
npm run db:seed
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

---

## Useful commands

### Backend
```bash
cd backend
npm run dev
npm run build
npm run start
npm run db:seed
```

### Frontend
```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

### Docker
```bash
docker-compose up --build
docker-compose down
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose exec backend sh
```

---

## Environment variables

Main variables used by the actual code:

```env
MONGODB_URI=mongodb://mongodb:27017/asalingo

JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback

DEEPSEEK_API_KEY=
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AsaLingo <noreply@asalingo.app>

FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:4000/api
BCRYPT_ROUNDS=12
```

Notes:
- `MONGODB_URI` is required by Mongoose/backend.
- Some AI helpers can fall back to stored data when `DEEPSEEK_API_KEY` is empty, but placement item generation, roadmap lesson/practice generation, and open-answer review require AI and should fail clearly with `503`.
- Password reset email uses SMTP when configured and falls back to an auto-created Ethereal inbox when `SMTP_USER` / `SMTP_PASS` are empty.
- Frontend auth requests use `withCredentials: true`, so CORS and cookie settings matter.

---

## Architecture notes

## Backend flow

`src/index.ts` configures:
- helmet
- cors using `FRONTEND_URL`
- compression
- cookie-parser
- express JSON parser
- morgan → Winston logger
- passport
- rate limiter on `/api`
- aggregated routes
- global error handler

### Backend module map

#### `modules/auth`
Handles:
- register
- login
- refresh token
- logout
- current user
- Google OAuth callback
- forgot password endpoint

Important:
- access token is sent to frontend
- refresh token uses cookie flow
- refresh tokens are persisted in DB and rotated

#### `modules/users`
Handles:
- `GET /users/me`
- profile update
- onboarding completion
- user stats
- delete account

#### `modules/words`
Handles:
- word catalog list with filters
- recommended words
- search
- word detail
- user-specific word state: save / learned / difficult / update status / remove

#### `modules/practice`
Handles:
- daily practice
- practice submission
- session tracking

#### `modules/ai`
Handles:
- word explanation
- generated examples
- quiz generation
- similar words
- DB caching in `AIContentCache`

Current split:
- `ai.service.ts` is the stable barrel for callers
- `ai.quiz.service.ts` holds the large AI/quiz implementation surface
- `ai.explain.service.ts`, `ai.generation.service.ts`, and `ai.cache.service.ts` expose focused entry points

---

## Frontend flow

Main routing lives in `frontend/src/App.tsx`.

Public routes:
- `/`
- `/login`
- `/register`
- `/forgot-password`
- `/auth/google/callback`

Protected flow:
- `/onboarding` requires auth
- `/app/*` requires auth + completed onboarding

App pages:
- Home
- Discover
- Word Detail
- My Words
- Practice
- Progress
- Profile

### Frontend state/auth notes

Auth is stored in Zustand with persistence:
- `user`
- `accessToken`
- `isAuthenticated`

Locale preferences are also persisted in Zustand:
- `locale`
- `darkMode`
- hydration applies the `dark` class on `document.documentElement`

Axios client:
- injects `Authorization: Bearer <token>`
- auto-refreshes access token on `401`
- retries queued requests after refresh
- logs user out if refresh fails

---

## Database overview

MongoDB collections (Mongoose models):
- `users` — User model
- `refreshtokens` — RefreshToken model
- `vocabularywords` — VocabularyWord model
- `userwords` — UserWord model
- `learningsessions` — LearningSession model
- `aicontentcaches` — AIContentCache model (7-day TTL, auto-expired)

Enums (defined as TypeScript string literals in models):
- `AuthProvider`: EMAIL, GOOGLE
- `CefrLevel`: A1, A2, B1, B2, C1, C2
- `WordStatus`: NEW, LEARNING, LEARNED, DIFFICULT, SAVED
- `PracticeType`: MULTIPLE_CHOICE, FILL_BLANK, MATCH, SENTENCE_CONTEXT, DAILY_REVIEW
- `PartOfSpeech`: NOUN, VERB, ADJECTIVE, ADVERB, PREPOSITION, CONJUNCTION, PRONOUN, INTERJECTION, PHRASE

Important relationships (via ObjectId references):
- `User` → many `UserWord`
- `User` → many `LearningSession`
- `User` → many `RefreshToken`
- `VocabularyWord` → many `UserWord`
- `VocabularyWord` → many `AIContentCache`

---

## API surface

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `POST /api/auth/forgot-password`

### Users
- `GET /api/users/me`
- `PATCH /api/users/me`
- `POST /api/users/me/onboarding`
- `GET /api/users/me/stats`
- `DELETE /api/users/me`

### Words
- `GET /api/words`
- `GET /api/words/recommended`
- `GET /api/words/search`
- `GET /api/words/:id`
- `GET /api/words/me/list`
- `POST /api/words/me/:wordId/save`
- `POST /api/words/me/:wordId/learned`
- `POST /api/words/me/:wordId/difficult`
- `PATCH /api/words/me/:wordId/status`
- `DELETE /api/words/me/:wordId`

### Practice
- `GET /api/practice/daily`
- `POST /api/practice/submit`

### AI
Check `backend/src/modules/ai/ai.routes.ts` when editing or extending AI endpoints.

---

## Working conventions for this repo

When changing this project, follow these rules:

1. **Do not rewrite architecture casually.**
   Keep the current split between frontend, backend, Mongoose, and Docker unless there is a clear reason.

2. **Preserve mobile-first UX.**
   This app is designed as a mobile-first language-learning product.

3. **Keep auth flow stable.**
   Do not break:
   - persisted auth store
   - cookie-based refresh flow
   - Axios retry queue on 401
   - Google callback redirect flow

4. **Prefer small module-local changes.**
   If a feature belongs to `words`, keep logic in `modules/words` and matching frontend files.

5. **Respect CEFR level logic.**
   AI prompts, recommendations, and practice content must remain level-aware.

6. **Keep truthful AI availability behavior.**
   Preserve real fallbacks where they already exist, but do not claim DB/fallback content for flows that require live AI generation or review.

7. **Do not silently change env contract.**
   If a new variable is introduced, update:
   - `.env.example`
   - `README.md`
   - this `CLAUDE.md` if relevant

8. **Validate inputs at route level.**
   Continue using `express-validator` and the shared `validate` middleware.

9. **Use Mongoose carefully.**
   Avoid N+1 queries; use `.populate()` and `.select()` explicitly. Prefer lean queries where documents are read-only.

10. **Do not invent features that do not exist.**
    For example, forgot password currently exists as an endpoint entrypoint, but actual email reset flow must be checked before claiming it is fully implemented.

---

## Known mismatches / things to verify before large changes

1. **`.env` naming consistency**
   Ensure root `.env`, Docker Compose env, and backend expectations stay aligned.

2. **Forgot password flow**
   Route exists, but verify whether it is placeholder-only or fully implemented before expanding UI around it.

3. **Google OAuth production readiness**
   Callback, frontend redirect, cookie settings, and CORS should be re-checked before deployment.

4. **Frontend alias imports**
   The code uses `@/` imports, so Vite/TS alias config should be kept intact when refactoring.

---

## How Claude should work on this repo

When asked to implement something:

### For backend tasks
- inspect the matching module first
- update controller/service/routes consistently
- check Mongoose model impact
- if adding a new field, update the model schema and any relevant indexes
- preserve auth and validation patterns

### For frontend tasks
- find the page, hook, API client, and types involved
- keep the current mobile-first layout structure
- reuse existing UI components where possible
- avoid introducing a heavy UI library unless explicitly requested

### For full-stack tasks
- update backend route/service first
- then update frontend API module
- then hook/page/component
- then types
- then test the full flow mentally or manually

### For bug fixing
Always identify:
- where the bug happens
- whether it is frontend, backend, env, or DB related
- exact files to change
- what can break as a side effect

---

## Preferred answer style for this repo

When helping on AsaLingo:
- be practical
- be specific
- reference real files
- avoid generic theory
- do not claim a feature exists unless it is visible in code
- if something is unclear, say it needs verification

Good format:
- root cause
- files to edit
- exact change
- command to run
- what to test after

---

## Safe implementation checklist

Before finishing a task, verify:
- TypeScript still compiles
- Mongoose model changes are reflected in all queries using that model
- frontend API paths match backend routes
- auth-protected routes still require auth
- onboarding logic still redirects correctly
- Docker flow still works if touched
- no README/env contradictions were introduced

---

## Suggested next cleanup tasks

1. Add a root-level bootstrap/dev script layer for easier onboarding.
2. Verify forgot-password implementation end-to-end.
3. Add production deployment notes for cookies, CORS, and OAuth.
4. Add lint/typecheck consistency on backend if desired.
5. Document the AI route contract more explicitly.

---

## One-line summary

This is a mobile-first full-stack vocabulary learning app with JWT + Google auth, MongoDB 7 + Mongoose persistence, practice tracking, and DeepSeek-powered AI helpers with a mix of real fallbacks and explicitly AI-required flows.
