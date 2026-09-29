# FrontendAgents.md

Working notes for anyone (person or coding agent) touching the front end of this
repository: the UI in `packages/app/` and the web shell in `packages/web/`. Read this before
writing front-end code. It describes the
conventions the codebase already follows. When in doubt, find a similar existing
piece (`views/Board/`, `hooks/useWorkspace.ts`) and copy its shape.

The server has its own rules in `CLAUDE.md`. Everything there still applies here,
including the comment policy: no comments by default, only for a trick, an
outside constraint, a trade-off, or a business reason the code cannot show.

## 1. Stack and tooling

React 19 with TypeScript, built by Vite 8 (rolldown) through
`@vitejs/plugin-react`. Vitest with jsdom and `@testing-library/react` for tests.
Plain CSS, no preprocessor. Fonts come from `@fontsource`.

There is deliberately **no** state library, no router, no component library, no
CSS framework and no data-fetching library. The whole client is `useState`, two
hooks, one `fetch` wrapper and one stylesheet. Do not add any of the above.

```bash
npm run dev:web                  # Vite dev server; add ?mock for sample data
npm run -w bacthang-web typecheck  # tsc --noEmit, covers packages/app/ through the alias
npm run -w bacthang-web test       # Vitest, the only UI test suite
npm run -w bacthang-web build      # the strongest check that everything wires up
```

`typecheck` and `test` for `bacthang-web` must be clean before a commit. For
anything that touches imports, aliases or assets, run the build too: a type error
is not the same as a bundle that resolves.

## 2. Project structure

```
packages/app/src/        The whole UI. Knows nothing about the shell around it.
  RankingApp.tsx         Root: providers plus the signed-in shell
  platform.ts            The Platform interface, the only seam between shells
  context.ts             PlatformContext and usePlatform
  api.ts                 Transport: one function per endpoint, ApiError
  events.ts              The SSE subscription
  types.ts               Every client-facing shape, mirroring the server DTOs
  constants.ts           Values shared by both shells
  format.ts              Pure display helpers
  i18n.tsx               LangProvider, useLang, translate
  locales/{vi,en}.ts     The two dictionaries
  hooks/                 useSession, useWorkspace
  components/            Multi-consumer UI only: Avatar, TierBadge, LangToggle, PlayerTip
  views/                 One screen or tab each
    Recent.tsx           A small view stays one file
    Shell/               The signed-in frame: header, tabs, panel, banners
    Record/              A view that outgrew one file
      Record.tsx         Root, stateful
      index.ts           export { Record } from "./Record.js"
      elements/          Single-consumer presentational pieces
  mock.ts                Sample data, dev builds only
  styles.css             The whole design system

packages/web/src/        The shell: redirect sign-in, localStorage, responsive frame
packages/web/test/       The UI test suite, which reaches packages/app/ through the alias
```

Placement rule: a component with exactly one consumer lives beside that
consumer, inside its `elements/` folder. Only put something in
`packages/app/src/components/` when two or more places use it.

Size limits, enforced by review rather than a linter:

- 300 lines per file. `locales/vi.ts` and `locales/en.ts` are the two exceptions,
  because a dictionary is data.
- 80 lines for a render return. Past that, extract an `elements/` sub-component.
- 12 statements in a component body before the `return`. Past that, extract a hook.
- One props object per component, destructured in the signature. Never three
  positional parameters.

A view stays a single `views/X.tsx` while it fits. Once it needs an `elements/`
folder it becomes `views/X/` with `X.tsx`, `index.ts` and `elements/`, and
importers change to `./views/X/index.js`.

## 3. Imports

There are no auto-imports. Every import is explicit, and **every relative
specifier ends in `.js`**, even when the file on disk is `.ts` or `.tsx`: this is
native ESM resolution, and TypeScript is configured to expect it.

No import ever climbs with `../`. Same folder uses `./x.js`; everything else uses
the `@app/` alias, which the Vite config, the tsconfig and Vitest all map to
`packages/app/src/`.
That way a file can move between `views/` and `views/X/elements/` without
rewriting its imports.

```ts
import type { Board } from "@app/types.js";          // correct
import { OpponentPicker } from "./elements/OpponentPicker.js";   // correct
import type { Board } from "../types.js";            // never
import { RankingApp } from "../../app/src/RankingApp.js";        // never
```

## 4. The Platform seam

`packages/app/` must not know what hosts it. Everything the host provides goes through the
`Platform` interface in `packages/app/src/platform.ts`: the token, the active workspace,
starting sign-in, and the stale-version callback. The seam is kept even though
there is one shell today, because it is what made the Chrome extension build
possible with no change to `packages/app/`, and it is what keeps the UI testable against a
fake platform.

Standard web APIs (`fetch`, `location`, `localStorage`, `crypto`) may be used
directly. A host-specific API in `packages/app/` is always a bug.

Sign-in failures never travel as prose. The shell returns a `LoginErrorCode` from
`platform.ts` and the UI translates it. Code that renders before `LangProvider`
mounts uses the standalone `translate()` from `i18n.tsx`.

## 5. Types

`packages/app/src/types.ts` is the single home for client-facing shapes, and it mirrors
what the server actually returns. Do not add a `types.ts` next to a view for a
shape two files share; put it in `types.ts`.

A union used in more than one file gets a name there (`Role`, `MemberStatus`,
`MatchResult`, `TierId`, `Tab`) and is referenced by that name. A union used once
stays inline. There are no client-side enums and no const objects standing in for
one.

No non-null assertions. Narrow with a guard instead. The single accepted
exception is mounting the root element in each shell's `main.tsx`.

## 6. Scoring rules come from the server

Never hardcode a points value, a tier threshold or the daily limit in the UI.
They arrive in `board.rules` and `board.me` and are rendered from there
(`fmtDelta(me.winPoints)`, `t("rules.daily.title", { n: rules.dailyLimitPerPair })`).
A number typed into a view is a bug waiting for the day the rule changes.

The one exception is a validation bound the form needs before it can call the API,
such as the workspace name length. Those live in `packages/app/src/constants.ts` with a
comment naming the server constant they mirror.

## 7. Styling

`packages/app/src/styles.css` holds the whole design system: tokens on `:root`, then flat
semantic class names (`.member`, `.pick-left`, `.ws-row`). The shell adds only its
own frame, in `packages/web/src/web.css`.

- No utility classes, no CSS-in-JS, no inline `style` objects except a value that
  is genuinely dynamic (a computed size or percentage).
- Class names are flat and lowercase with hyphens. No BEM blocks, no nesting
  deeper than two selectors.
- Colours, spacing and radii come from the `:root` custom properties. Both light
  and dark are defined; a new colour is added to both or it is not added.
- Icons are inline SVG, with `aria-hidden="true"` when decorative or an
  `aria-label` when they carry the meaning. There is no icon package.

## 8. i18n

Every user-facing string goes through `t("key")`. A sentence, label or word typed
straight into JSX is a bug. Punctuation, a separator and a number rendered from
data are not strings in this sense and stay as they are.

Keys live in `packages/app/src/locales/vi.ts` and `packages/app/src/locales/en.ts`, grouped by
prefix (`app.`, `board.`, `record.`, `rules.`, `ws.`, `group.`, `err.`) and kept
in the same order in both files. `vi.ts` is the source of truth for the key set:
`en.ts` is typed `Record<Key, string>`, so TypeScript fails the build when a key
is missing on either side. Do not add a runtime parity test; the type already
does it.

Parameters are `{name}` placeholders substituted by `format`, never string
concatenation in a view.

Server errors are translated by code: `tError(code, fallbackFromServer)`. Adding
a server error code means adding an `err.<CODE>` entry to both dictionaries. Tier
names come from `tierName(tier.id)`, never from the server's text.

## 9. Data layer

`packages/app/src/api.ts` is pure transport. One function per endpoint, each returning a
parsed body, each throwing `ApiError` carrying the server's code. No React, no
state, no retry logic. `fetch` appears in exactly two files, `api.ts` and
`events.ts`; anywhere else it is a bug.

State lives in the two hooks:

- `hooks/useSession.ts` owns the token and signing out.
- `hooks/useWorkspace.ts` owns the account, the board, the recent list, the live
  connection and `describeError`. It also owns the SSE subscription, with refs
  rather than state in the effect dependencies, because a changing dependency
  there reconnects the stream on every board refresh.

Views do not fetch the data they render. They receive it and their callbacks
through props, and a callback returns a translated error string or `null`. The one
accepted exception is `views/Group`, which loads the member list it alone uses.

## 10. Components and views

A view is one screen or one tab, and it owns its own local UI state (the search
box, the confirm step). It reports upward through callbacks and never reaches into
a sibling.

Elements under `elements/` are presentational: props in, JSX out, no API calls and
no server state. Transient UI state that nobody else needs may live inside one (a
popover's open flag, as in `Shell/elements/WorkspaceSwitcher.tsx`). State that a
sibling or the view root has to see moves up to the root, which is why the kick
confirmation lives in `Group.tsx` and not in `MemberRoster.tsx`.

No nested ternaries. Three or more conditional branches in JSX becomes either a
small helper that returns the value or an element that picks its own branch with
`if`. Two branches with `cond ? a : b` are fine.

Lists always carry a stable `key` from the domain id, never the array index.

Accessibility is part of the component, not a later pass: `role="radiogroup"` plus
`role="radio"` and `aria-checked` for a choice, `role="tablist"` and
`aria-selected` for the tabs, `role="alert"` for an error and `role="status"` for a
confirmation, and an `aria-label` on every icon-only button.

## 11. Naming and code style

Descriptive names. No single-letter identifiers for values: `member`, not `m`;
`player`, not `p`; `workspace`, not `w`. Only `t` (translate), `e` or `err` (event
or error) and `_` are allowed short.

Components and types are PascalCase, hooks are `useX`, and a file is named after
its primary export: `PascalCase.tsx` for a component, `camelCase.ts` for a hook,
lowercase for a plain module (`api.ts`, `format.ts`). Exports are named; there is
no `export default` anywhere in the front end.

A single-statement guard may skip braces (`if (!token) return;`), which the
codebase does throughout. Anything with two statements or an `else` takes braces.

An async handler that can fail returns the error rather than throwing into the
void: `Promise<string | null>`, and the caller shows the message.

## 12. Testing

`packages/web/test/` is the only UI suite. It renders the real `RankingApp` against a fake
platform from `packages/web/test/fake.ts`, so a test exercises the UI exactly as the shell
does.

- Fixtures are built with `makePlayer` / `makeBoard` overrides, never hand-written
  object literals.
- Identifiers and test names are English. Assertions on Vietnamese strings are
  correct and deliberate: they verify the Vietnamese UI path.
- Query by role and accessible name first, by text second, and reach for
  `data-testid` only where neither exists.
- A fixed bug gets the test that reproduces it, written first. The "re-picking the
  open workspace" test in `app.test.tsx` exists because that bug reached
  production.

## 13. Before finishing a change

1. `npm run -w bacthang-web typecheck` passes.
2. `npm run -w bacthang-web test` passes.
3. `npm run -w bacthang-web build` succeeds if imports, aliases or assets moved.
4. New user-facing text has a key in **both** locale files.
5. No scoring number, tier threshold or limit is hardcoded in the UI.
6. No file over 300 lines, no render return over 80, no nested ternary in JSX.
7. No host-specific API in `packages/app/`, no relative import climbing out of `packages/web/`,
   every relative specifier ends in `.js`.
