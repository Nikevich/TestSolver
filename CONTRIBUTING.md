# Contributing to TestSolver

Thanks for your interest. TestSolver is dual-licensed (AGPL-3.0-only or a commercial license), so a few rules apply to every contribution.

## Before you start

- **Open an issue first** for anything larger than a bug fix, so we can agree on the approach.
- **Sign the CLA** — see [`CLA.md`](CLA.md). Pull requests without a signed CLA cannot be merged. This is required because the project is dual-licensed.
- By contributing, you agree that your contribution may be distributed under the AGPL-3.0-only and under the project's commercial license.

## What we accept

- Bug fixes and reliability improvements.
- Adapters for new test platforms (see `src/main/dom.js` and the fixtures in `fixtures/`).
- Documentation and translations.
- Performance improvements that do not add runtime dependencies.

## What we do not accept

- Code copied from projects whose license is incompatible with the AGPL-3.0-only (for example, GPL-2.0-only, proprietary, or source-available code).
- New runtime dependencies without prior discussion — the app intentionally ships without them.
- Changes that weaken the user's ability to run modified versions of the program (DRM, telemetry that cannot be disabled, license checks).

## Code style

- Plain JavaScript, no build step, no transpilers.
- Every `.js` file starts with an SPDX header:

  ```js
  // SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Commercial
  // Copyright (C) 2026 Shkilevich Nikita
  ```

- Use `'use strict';`, 2-space indentation, single quotes, semicolons.
- Keep the main/renderer boundary: privileged operations live in `src/main`, the UI talks to it through `src/preload/preload.js` and the channels in `src/shared/ipc.js`.
- User-facing strings are in Russian; keep the existing tone.

## Testing

Run before opening a pull request:

```
npm run smoke
npm run test:adapters
```

Both must pass. If your change affects the UI, attach a screenshot.

## Pull request checklist

- [ ] CLA signed in the PR description.
- [ ] SPDX header present in every new or modified `.js` file.
- [ ] `npm run smoke` and `npm run test:adapters` pass.
- [ ] No new runtime dependencies.
- [ ] No third-party code without a compatible license and an entry in `THIRD-PARTY-NOTICES.md`.
- [ ] Documentation updated (README, `docs/USAGE.*`, or `COMMERCIAL.md` if licensing is affected).
