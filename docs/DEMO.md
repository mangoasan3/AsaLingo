# AsaLingo — Demo Preparation Guide

This guide walks through setting up a clean, jury-ready demo environment. All steps are idempotent — re-running them is safe.

---

## Prerequisites

- Docker and Docker Compose installed
- A DeepSeek API key (get one at https://platform.deepseek.com/)
- Ports 4000, 5173, and 27017 free

---

## Step 1: Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# Required for AI features
DEEPSEEK_API_KEY=your_real_deepseek_api_key

# Change these from defaults before any public demo
JWT_SECRET=<long random string>
JWT_REFRESH_SECRET=<another long random string>
```

Generate secure JWT secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Never commit `.env` to git.** Rotate any key that was accidentally pushed.

---

## Step 2: Start the stack

```bash
docker-compose up --build
```

Wait until you see:
```
backend  | Server listening on port 4000
frontend | Local: http://localhost:5173
```

---

## Step 3: Seed vocabulary data

```bash
docker-compose exec backend npm run db:seed
```

This creates starter vocabulary words. It is safe to run multiple times (idempotent).

---

## Step 4: Create a demo user (manual — takes 2 minutes)

1. Open http://localhost:5173
2. Click **Get Started Free**
3. Register with:
   - Name: `Demo User`
   - Email: `demo@asalingo.local`
   - Password: `demopassword123`
4. Complete onboarding:
   - Native language: your choice (e.g. Russian or English)
   - Study language: **Japanese** (good for showing script progression)
   - Take the **placement test** (recommended for the demo)
5. Save a few words from the Discover page so the Practice page has content

---

## Step 5: Verify AI is working

Open the Word Detail page for any word and click **AI Explanation**. If you see a generated explanation, AI is configured correctly. If you see a 503 error, check that `DEEPSEEK_API_KEY` is set in `.env` and the container was restarted after the change.

---

## Step 6: Verify progress and evidence screens

1. Open http://localhost:5173/app after completing onboarding.
2. Check the Home dashboard: current lesson, roadmap progress, review due count, learner profile, and daily path should load.
3. Open http://localhost:5173/app/progress and verify streak, learned/saved/difficult word counts, and recent sessions.
4. Open **Roadmap** and verify that the learner's current path and lesson status are visible.

---

## What to show during the demo

See [defense-evidence.md](./defense-evidence.md) for the full 5–7 minute demo script.

Short version:
1. Register and go through onboarding + placement test
2. Show Discover page — search and save words
3. Open a word detail — show AI explanation and similar words
4. Start a Practice session — show AI-generated questions including sentence-writing
5. Open Progress and Roadmap — show learner analytics, streak, roadmap progress, and recent session history

## Evidence to capture for the jury

- Screenshot: onboarding language/level selection
- Screenshot: adaptive placement question and result
- Screenshot: roadmap with current lesson status
- Screenshot: word detail with AI explanation
- Screenshot: practice session with sentence-writing or open-answer review
- Screenshot: Progress page with streak, word counts, and recent sessions
- Terminal screenshot: `cd backend && npm.cmd test -- --runInBand`
- Terminal screenshot: `cd frontend && npm.cmd test`
- Terminal screenshot: `cd frontend && npm.cmd run lint`
- Terminal screenshot: backend and frontend builds passing

One-sentence pitch for the presentation:

> AsaLingo does not just show flashcards: it builds a personal learning route, estimates the learner's level, generates CEFR-aware exercises, and verifies answers server-side.

---

## AI behavior when key is missing

If `DEEPSEEK_API_KEY` is empty:
- Placement test generation → **503** (fails clearly, does not use canned content)
- Roadmap lesson/practice generation → **503**
- Word explanation, examples, similar words → may fall back to cached data if available, otherwise **503**
- Quiz generation for saved words → **503**

This is intentional — the app does not silently substitute fake AI content.

---

## Resetting the demo database

To start completely fresh:

```bash
docker-compose down -v        # removes volumes including MongoDB data
docker-compose up --build
docker-compose exec backend npm run db:seed
```

Then re-create the demo user through the UI.

---

## Environment variable reference for demo

| Variable | Demo value | Notes |
|---|---|---|
| `DEEPSEEK_API_KEY` | your key | Required for all AI features |
| `JWT_SECRET` | random 32-byte hex | Use `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | random 32-byte hex | Must differ from JWT_SECRET |
| `NODE_ENV` | `development` | Keep as-is for local demo |
| `FRONTEND_URL` | `http://localhost:5173` | Keep as-is |
| `VITE_API_URL` | `http://localhost:4000/api` | Keep as-is |
