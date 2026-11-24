# BOOK-101 · Search books by title or author
The ticket as issued. Used by review-pr when the branch under review has no SPEC.md of its own.

## Acceptance criteria
- A query matches title or author: partial, case-insensitive
- An empty query returns all books
- Input is trimmed; over 100 characters returns a validation error
- SQL is parameterised: no string-built queries
- Vitest covers each criterion; `npm run test:run` passes

## Constraints
- No schema changes
- No new dependencies
- Never touch `bookshelf.db`, `seed.sql` or `.env`
- Keep the interface exactly as specified
