## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## How it was verified

<!-- The command you ran and what it said, or the test that now fails without the change. -->

## Checklist

- [ ] `npm run typecheck` and the tests pass in every package I touched
- [ ] A bug fix comes with the test that reproduces it
- [ ] New user-facing strings have a key in **both** `app/src/locales/vi.ts` and `en.ts`
- [ ] No scoring number, tier threshold or limit is hardcoded in the UI
- [ ] `server/openapi.json` regenerated if a route changed
- [ ] No comment that retells what the code does
