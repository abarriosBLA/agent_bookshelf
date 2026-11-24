# SPEC · BOOK-101 · Search books by title or author

## Goal
A reader types in the search box on `/` (or calls the API) and gets the books whose
title or author contains what they typed. Today `GET /books/search` is a TODO stub.

## Interface (keep exactly)
| Surface | Request | Success | Validation error |
|---|---|---|---|
| Model | `Book.searchBooks(query: string): Book[]` in `src/models/book.ts` | array of `Book` rows ordered by `title` | throws `SearchValidationError` (exported from `src/models/book.ts`) |
| JSON API | `GET /api/books/search?q=<query>` | `200`, JSON array of `Book` (same shape as `GET /api/books`) | `400`, `{ "error": "<message>" }` |
| HTML (HTMX) | `GET /books/search?q=<query>` | `200`, HTML partial: the `book-grid` of matching books, or `<p class="no-results">No books found</p>` | `400`, `<p class="error"><message></p>` |

`Book` = `{ id, title, author, isbn, cover_url, description, published_year, created_at }`.
`/api/books/search` must be registered before `/api/books/:id`, so `search` is never parsed as an id.

## Acceptance criteria (each one gets at least one Vitest test)
| # | Criterion | Example |
|---|---|---|
| AC1 | Matches **title or author**, **partial**, **case-insensitive** | `prag` → "The Pragmatic Programmer"; `HUNT` → books by Andrew Hunt; `orwell` → "1984" |
| AC2 | **Empty query returns all books** (50 seeded), ordered by title. Missing `q`, `q=` and whitespace-only `q` all count as empty | `GET /api/books/search` → 50 books |
| AC3 | Input is **trimmed** before matching and before the length check | `"  dune  "` behaves like `"dune"` |
| AC4 | Over **100 characters** (after trim) → validation error. Exactly 100 is allowed | 101 × `a` → 400; 100 × `a` → 200 `[]` |
| AC5 | SQL is **parameterised**: the query only ever reaches SQLite as a bound parameter. `%`, `_` and `\` in the input are matched literally (escaped, `LIKE ... ESCAPE '\'`), and SQL-looking input is just text | `%` → `[]` (no title contains `%`); `' OR 1=1 --` → `[]`, and the books table is unchanged |
| AC6 | A `q` that isn't a single string (`?q=a&q=b`) → validation error | `400` |
| AC7 | No match → empty result, not an error | `zzzz` → `200 []` / "No books found" |
| AC8 | `npm run test:run` passes, old tests included | |

Validation messages: `"Search query must be 100 characters or fewer"` and `"Search query must be a single string"`.

## Constraints
- No schema changes (`src/db/schema.sql`), no new dependencies (`package.json` unchanged).
- Never touch `bookshelf.db*`, `src/db/seed.sql` or `.env` (a hook enforces this).
- No string-built SQL anywhere in the diff. No FTS, no new tables, no new indexes.
- Least new code: reuse `all()` from `src/db/index.ts`; validation lives in the model, routes only map it to 400.
- The search `<input>` in `src/views/books/index.ejs` gets `maxlength="100"` (HTMX doesn't swap 4xx responses, so this is the UI's guard). No other view changes except the results partial.

## Out of scope
Pagination, ranking, searching description/ISBN, accent-insensitive matching (SQLite `LIKE` folds ASCII only), UI redesign.

## Verification
1. `npm run test:run` → green; the new tests cover AC1–AC7 by name (`AC1 ...`).
2. `npm run build` → no TypeScript errors.
3. `git diff main -- src/db/schema.sql src/db/seed.sql package.json` → empty.
4. Manual: `npm run dev`, type `asimov` in the search box → only Asimov's books.
