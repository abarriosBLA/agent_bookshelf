# Agent Bookshelf

Goodreads-lite teaching app: Express + TypeScript (ESM), SQLite via sql.js (WASM), EJS + HTMX views, Vitest.
The current ticket is in `SPEC.md`. Read it before changing code.

## Commands
- `npm run test:run` — run all tests once. This is the gate: it must pass before any commit.
- `npx vitest run tests/<path>.test.ts` — run one test file
- `npm run build` — `tsc` type-check + copy assets to `dist/`
- Don't run `npm run dev` / `npm start` in agent sessions: they write `bookshelf.db`.

## Layout
- `src/models/*.ts` — data access. All SQL lives here, through `all/get/run` in `src/db/index.ts`.
- `src/routes/books.ts` — HTML routes (EJS / HTMX partials). `src/routes/api.ts` — JSON API under `/api`.
- `src/views/` — EJS templates. `tests/` — Vitest; each file inits its own DB under `/tmp` with `initDb(path)`.

## Rules
1. **SQL is always parameterised**: `?` placeholders + params array. Never build SQL from input with `+` or template strings.
   The only allowed interpolation is fixed column lists built from code (like `updateBook`).
2. **Validation lives in the model**; routes translate it to HTTP (`400` + `{ error }` for JSON, `<p class="error">` for HTML).
3. **No schema changes, no new dependencies.** `src/db/schema.sql` and `package.json` dependencies stay as they are.
4. **Never touch** `bookshelf.db*`, `src/db/seed.sql`, `.env`. A hook blocks it; don't try to work around it.
5. **Tests first.** New behaviour gets a failing test, then the code. Name tests after the spec criterion (`AC3 trims input`).
   While implementing, `tests/` is read-only: if a test looks wrong, stop and say so.
6. **Least new code**: smallest change that meets the spec; reuse what the codebase already has before adding anything new. No refactors, renames or style changes outside the ticket.
7. Keep the interface in `SPEC.md` exactly: paths, status codes, response shapes, error messages.
8. Specific routes go before parameter routes (`/books/search` before `/books/:id`).

## Git
- Work on a feature branch, never `main`. Small Conventional Commits (`feat:`, `test:`, `fix:`, `docs:`, `chore:`).
- Fix a bug with a new commit; never amend or rewrite history. Never push without asking.
- Commit only when `npm run test:run` is green.
  One exception: the `test:` commit that adds failing tests before the implementation (red first).
