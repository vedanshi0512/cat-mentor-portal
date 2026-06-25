# CAT Mentor Portal

A static, serverless CAT (Common Admission Test) mock-test platform for one mentor and a small group of aspirants. No backend, no database server — **the GitHub repository itself is the database**, accessed entirely through the GitHub REST API from the browser.

---

## How this actually works (read this first)

- This is a **static React app** hosted on GitHub Pages. There is no server.
- All data — questions, tests, student attempts, bookmarks, notes — lives as **JSON files inside a GitHub repo**.
- The app reads/writes those files directly from the browser using the **GitHub Contents API**, authenticated with a **Personal Access Token (PAT)**.
- **There is one shared token for the whole app**, configured once per browser. Mentor and every student use the *same* token. There is no per-student password — "logging in" just means picking your name from a list so the app knows whose data to read/write and how to label commits. **Anyone with this token (or access to a browser where it's saved) can read or write any student's data, or act as the mentor.** This is intentional, by design, for a small trusted group — do not use this for a setting where students shouldn't see each other's data.

If you need real per-user security, see "Stronger auth (optional)" near the bottom — it's a meaningfully bigger lift and isn't built by default.

---

## Two repos, one decision to make

You need a GitHub repo to hold the **data** (questions.json, tests.json, student folders, etc). You have two options:

1. **Same repo for app + data** (simplest): Push this code to a repo, e.g. `cat-mentor-portal`. The GitHub Action below builds and deploys the `dist/` folder to Pages, while the *source* JSON files live alongside the code in `data/` and `student-data/`. Every student/mentor write commits directly to this repo's `main` branch (or whichever branch you configure).
2. **Separate data repo**: Keep the app code in one repo (for clean GitHub Actions deploys) and point the app's Setup screen at a *different* repo purely for data. This avoids every test attempt triggering noise in your app's commit history, and lets you make the data repo private while the app repo (which must be public, or Pages-enabled) stays separate.

Either is fine. Pick based on whether you mind commit-history noise in your app repo. **Whichever you choose, the data repo must exist before first use** — the app does not create a repo, only files within one.

---

## One-time setup

### 1. Create (or choose) your data repo
On GitHub, create a repo (can be private). You don't need to pre-create any folders — the app creates `data/questions.json`, `data/students.json`, etc. on first write. If you want to seed it yourself, see "Repository structure" below.

### 2. Create a Personal Access Token
This token needs **write access to Contents** on your data repo.

- Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
- **Generate new token**, scope it to **only your data repository** (don't grant org-wide or all-repo access)
- Under **Repository permissions**, set **Contents: Read and write**
- Generate and copy the token — you won't see it again

This token will be pasted into the app's Setup screen and stored in `localStorage`. It is never committed to any file or sent anywhere except GitHub's API.

### 3. Deploy the app
```bash
npm install
npm run build       # sanity check it builds locally
git push origin main
```
GitHub Actions (`.github/workflows/deploy.yml`) builds and deploys automatically on every push to `main`. Enable Pages once: **Repo → Settings → Pages → Source: GitHub Actions**.

If your repo name isn't `cat-mentor-portal`, update the `base` path in `vite.config.ts` and the `basename` in `src/App.tsx` to match — both must equal `/<your-repo-name>/`.

### 4. First-run configuration (in the app, not code)
Open the deployed site. You'll land on **Setup**:
- Repository owner (your GitHub username/org)
- Repository name (the data repo from step 1)
- Branch (usually `main`)
- The token from step 2

Click **Connect & Continue**. This is verified live against the GitHub API before saving.

### 5. Add students
Log in as **Mentor** → **Students** tab → **Add student**. Each student then opens the same deployed URL, runs through Setup with the *same* token/repo/branch, and picks their name from the login screen.

---

### Creating tests and questions
There is no separate "question bank" page. Questions are created directly while building a
test: open **Create test**, add a section, and use **Add new question** to author one inline
(text, optional image upload, options/answer) - saving it both adds it to the question bank
file and attaches it to that section in one action. **Pick from existing** lets you reuse a
question already created for an earlier test, in the same subject. Already-added questions in
a section can be edited or removed (removing only takes it out of that section - it stays in
the bank for reuse elsewhere).

### Deploys vs. data writes
Only changes to actual app code (`src/`, configs, the workflow itself) trigger a GitHub Pages
rebuild. Every in-app action - saving a question, submitting a test, adding a student, etc. -
is a plain data commit to `data/` or `student-data/` and does **not** trigger a rebuild. This
matters because rebuilds take 1-3 minutes and two rebuilds firing close together can cancel
each other out; keeping data writes silent avoids that entirely.

## Repository structure (the "database")

```
data/
  questions.json       — full question bank
  tests.json            — all tests (mock/sectional/topic/practice)
  students.json         — student roster + mentor display name
  topics.json           — configurable topic lists per subject

student-data/
  <student-id>/
    attempts.json       — every attempt (in-progress + submitted) for this student
    bookmarks.json      — bookmark folders + bookmarked questions
    notes.json          — personal notes per question
    tags.json            — custom tags per question
```

`<student-id>` is a slug derived from the student's name (e.g. "Rahul Sharma" → `rahul-sharma`), assigned when the mentor adds them.

Every file is plain JSON, versioned with a `version` field for future migrations, and editable by hand if you ever need to fix something directly on GitHub.

---

## Conflict handling

Every write goes through a **read → modify → write-with-SHA** cycle (`src/api/optimisticUpdate.ts`):
1. Fetch the current file and its `sha`.
2. Apply the change in memory.
3. `PUT` back with that `sha` attached.
4. If someone else committed in between, GitHub rejects the write (409/422) — the app catches this, re-fetches the now-current file, re-applies the change, and retries (up to 3 times with jittered backoff).

This correctly handles two students submitting at the same time, or a mentor editing the question bank while a student is mid-test — as long as each update function only depends on the data it's given, which is how every repo function in `src/api/*Repo.ts` is written.

---

## Architecture

- **React + TypeScript + Vite** — `src/`
- **Tailwind CSS** for styling, a light/white CAT-exam-inspired palette with blue as the primary accent (matching the look of the real official CAT test interface)
- **react-router-dom** for routing (`/setup`, `/login`, `/mentor/*`, `/student/*`)
- **recharts** for trend charts
- **No backend, no database, no Firebase/Supabase** — confirmed nowhere in the dependency tree

### Layers
- `src/types/` — all domain types (Question, Test, Attempt, Student, etc.)
- `src/api/githubClient.ts` — low-level GitHub Contents API wrapper (get/put JSON, base64 encode/decode, error mapping)
- `src/api/optimisticUpdate.ts` — generic retry-on-conflict read-modify-write helper
- `src/api/*Repo.ts` — typed CRUD functions per data file (questions, tests, students, attempts, bookmarks/notes/tags)
- `src/context/AuthContext.tsx` — holds the shared token (`credentials`) and the active user (`session`) in React state + localStorage
- `src/hooks/useTestAttempt.ts` — the CAT test-taking state machine (timers, section locking, autosave, auto-submit)
- `src/pages/mentor/*`, `src/pages/student/*` — feature pages
- `src/components/` — shared UI, test-runner UI (palette/timer/question area), question form

### CAT test-taking behavior implemented
- Per-section countdown timers; optional **section locking** (once time's up or you move on, you can't go back — toggle per section in the test builder)
- Five-state question palette: not visited / visited / answered / marked for review / answered & marked
- Save & Next, Mark for Review & Next, Clear Response, Previous
- Auto-submit when the last section's timer hits zero
- **Resume attempt**: progress autosaves every 20 seconds and on submit; reopening an in-progress test resumes exactly where you left off (per-question time spent, per-section time remaining, all responses)
- MCQ (single-select, radio) and TITA (free-text, numeric-tolerant comparison)

### Scoring
CAT-style: **+3 correct, −1 incorrect for MCQ, 0 for unattempted, no negative marking on TITA** (`src/utils/scoring.ts`). Adjust constants there if your mentor uses different marking.

---

## What's intentionally not built (Phase 2 ideas)

- **Question image upload (bulk import only)** — the single-question form (`QuestionForm`) has a real upload button: pick a file, it's committed straight to `data/images/<uuid>.<ext>` in the data repo via `src/api/imageUploadRepo.ts`, and the resulting path is attached to the question. One behavior worth knowing: **the image uploads immediately on selection**, as its own separate commit - it does not wait for you to click "Save" on the rest of the form. If you upload an image and then click Cancel instead of Save, the image file stays in the repo (harmless, just an unused file - no question will reference it). Bulk import (pasting a JSON array of many questions at once) still expects an already-known image path/URL in the JSON rather than a file picker, since there's no natural one-image-per-question UI in a bulk-paste flow.
- **Reattempt wrong questions / revision tests generated from bookmarks** — the `Test.generatedFrom` type field exists to support this, but the "generate a test from my wrong answers" button isn't wired up yet. Straightforward to add: query attempts for incorrect responses, build a `Test` object with those question IDs, save via `upsertTest`.
- **Custom student tags UI** — the repo layer (`addCustomTag`/`fetchCustomTags`) exists but isn't surfaced in a page yet; natural fit alongside notes in the post-test analysis view.
- **Heatmaps** (time-per-question visualized as a grid) — data is all there (`response.timeSpentSeconds` per question per attempt); needs a dedicated chart component.
- **Daily/weekly/monthly progress rollups** — currently only a simple attempt-over-attempt trend line; aggregating by calendar period is a pure function over existing attempt data.
- **Bulk import via CSV** — only JSON array import is built; CSV would need a parsing step (e.g. via PapaParse) mapped to the same `Question` shape.

None of these require architecture changes — they're additive on top of the existing repo/type layer.

---

## Stronger auth (optional, not built)

If a shared token ever stops being acceptable (e.g. the group grows, or trust drops), the realistic upgrade path is: each person creates their own fine-grained PAT scoped to the same repo, and the app's Setup screen becomes per-person instead of app-wide (store credentials keyed by a locally-chosen profile name rather than one global `AppCredentials`). GitHub's own collaborator permissions then become your real access boundary. This is a moderate rework of `AuthContext` and the Setup/Login pages, not a full rebuild.

---

## Local development

```bash
npm install
npm run dev
```

Visit the printed localhost URL. You'll still need a real GitHub repo + PAT to use any feature beyond the Setup screen, since there's no local/offline mode.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — type-check + production build to `dist/`
- `npm run preview` — preview the production build locally
- `npm run deploy` — manual deploy via `gh-pages` package (alternative to the GitHub Actions workflow)
