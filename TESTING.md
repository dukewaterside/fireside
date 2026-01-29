# Unit Testing Guide — Fireside

Step-by-step instructions to add and run unit tests. No test code is provided; use this as a checklist and reference.

---

## 1. Install test dependencies

- From the project root, run: `npm install`
- Confirm these devDependencies are present (they are already in `package.json`):
  - `jest-expo` — Jest preset for Expo (transforms and env)
  - `@testing-library/react-native` — React Native Testing Library
  - `@types/react` and `typescript` — type checking

If you add more test utilities (e.g. `jest-fetch-mock`, `@testing-library/jest-native`), install them and add any setup in the Jest config (see below).

---

## 2. Know where tests live

- Jest is configured to find tests via:
  - Files under any `__tests__` directory (e.g. `lib/__tests__/auth.test.ts`)
  - Files whose names end in `.test.(ts|tsx|js|jsx)` or `.spec.(ts|tsx|js|jsx)` anywhere in the project
- Two common layouts:
  - **Co-located:** e.g. `lib/services/auth.ts` → `lib/services/auth.test.ts` or `lib/services/__tests__/auth.test.ts`
  - **Centralized:** e.g. `__tests__/lib/auth.test.ts` mirroring `lib/services/auth.ts`
- Pick one convention and stick to it so the team (and `testMatch`) stay consistent.

---

## 3. Run the test suite

- **Run all tests once:**  
  `npm test`
- **Run tests in watch mode (re-run on file changes):**  
  `npm run test:watch`
- **Run tests with coverage:**  
  `npm run test:coverage`  
  Coverage output is in the `coverage/` directory (ignored by git). Open `coverage/lcov-report/index.html` in a browser for a report.

---

## 4. Decide what to unit test

- **`lib/services/auth.ts`**  
  Pure async functions (`signIn`, `signUp`, `signOut`, `resetPasswordForEmail`, etc.). Mock the Supabase client and assert on calls and return values (success/error).
- **`lib/services/tickets.ts`**  
  Same idea: mock Supabase (and any storage) and test `uploadTicketPhoto`, `getSignedTicketPhotoUrl`, and other exported functions.
- **`lib/constants/*`**  
  Optional: small tests that constants have expected shape or keys if you want to lock behavior.
- **`lib/navigation.ts`**  
  Mock `expo-router`’s `router` and test that `navigateToSignIn` calls `router.push('/sign-in')`.
- **`components/*`**  
  Use React Native Testing Library to render components with different props, query by role/label/text, and simulate press events. Assert on rendered output and callbacks.
- **Screens under `app/`**  
  Same as components, but you will need to mock Expo Router (e.g. `expo-router`, `useRouter`, `useLocalSearchParams`), Supabase, and any navigation so that screen components render in isolation.

Start with `lib` and small components; add screen tests once the basics pass.

---

## 5. Mock Supabase and Expo modules

- **Supabase**  
  In tests, mock `lib/supabase/client` (e.g. `jest.mock('../../lib/supabase/client')`) and replace `supabase.auth` and `supabase.from(...)` with stub objects whose methods return `{ data, error }` as your tests need.
- **Expo Router**  
  Mock `expo-router` (e.g. `jest.mock('expo-router')`) and provide fake `router.push`, `router.replace`, and, if used, `useRouter` / `useLocalSearchParams` so navigation doesn’t run and routes are predictable.
- **Other Expo/Native modules**  
  Mock any module that touches native code or network (e.g. `expo-image-picker`, `expo-file-system`) with `jest.mock('module-name')` and implement only the functions your code uses.

Put repeated mocks in a `__mocks__` directory or in a Jest setup file (see below) so individual tests stay short.

---

## 6. Optional: Jest setup file

- Create a file that runs once before tests, e.g. `jest.setup.js` or `jest.setup.ts` at the project root.
- In `package.json`, under `"jest"`, add:  
  `"setupFilesAfterEnv": ["<rootDir>/jest.setup.js"]`  
  (or `.ts` if you use ts-jest / appropriate transform).
- Use this file to:
  - Extend matchers (e.g. `@testing-library/jest-native`) if you install them
  - Set global test utilities or default mocks
  - Configure anything that must run before every test file

---

## 7. Optional: TypeScript and Jest

- Your `tsconfig.json` already includes `**/*.ts` and `**/*.tsx`, so Jest (via `jest-expo`) will transpile them.
- If you introduce a separate Jest/Node tsconfig, keep `module`/`target` consistent with what Jest and Babel expect so imports and types resolve the same as in the app.

---

## 8. Checklist before committing

- Run `npm test` and ensure all tests pass.
- If you care about coverage, run `npm run test:coverage` and fix any regressions.
- Ensure no test file or mock commits secrets (e.g. real Supabase keys). Use env or mocks only.
- Keep `coverage/` out of version control (it’s in `.gitignore`).

---

## 9. Quick reference

| Goal              | Command / location                          |
|-------------------|---------------------------------------------|
| Run tests         | `npm test`                                  |
| Watch mode        | `npm run test:watch`                        |
| Coverage          | `npm run test:coverage`                     |
| Where to put tests| `**/__tests__/**` or `**/*.test.ts(x)`      |
| Jest config       | `package.json` → `"jest"`                   |
| Setup file        | Optional: `jest.setup.js` + `setupFilesAfterEnv` |
| Coverage output   | `coverage/` (git-ignored)                   |

Use this guide to add your first tests next to `lib/services/auth.ts` or a small component, then expand from there.
