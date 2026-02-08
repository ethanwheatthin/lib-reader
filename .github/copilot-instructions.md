# Copilot Instructions — lib-reader

## Architecture Overview

This is an **Angular 21** EPUB/PDF reader app using **NgRx** for state management and **localforage** (IndexedDB) for client-side persistence. It follows a three-layer structure:

- **`src/app/core/`** — Domain models (`document.model.ts`), stateless services (`indexdb.service.ts`, `epub.service.ts`, `pdf.service.ts`)
- **`src/app/store/documents/`** — NgRx feature: actions (`createActionGroup`), reducer (`createFeature` + `@ngrx/entity`), selectors, class-based effects
- **`src/app/features/`** — Standalone UI components organized by domain: `library/`, `upload/`, `reader/` (with `epub-reader/` and `pdf-reader/` children)

**Data flow:** Component dispatches action → Effect calls service (async) → Service interacts with localforage → Effect dispatches success action → Reducer updates entity state → Selector feeds component via Observable or signal.

## Key Conventions

- **All components are standalone** — no `NgModule`. Angular 21 defaults to standalone; explicit `standalone: true` may appear on older components.
- **Use `inject()` exclusively** — no constructor-based injection anywhere in the codebase.
- **Inputs use `@Input()` decorator** (not signal inputs).
- **Mixed reactivity:** NgRx state is consumed via Observables (`store.select()` + `async` pipe). The epub-reader uses **signals** (`signal<T>()`) for local UI state (settings, panel position). Follow whichever pattern the component already uses.
- **External templates** (`templateUrl`) for feature components; inline `template` only for the root `App` shell.
- **Prettier** is configured in `package.json`: `printWidth: 100`, `singleQuote: true`, Angular HTML parser for `.html` files.

## NgRx Patterns

- Actions: `createActionGroup` with `props<>()` / `emptyProps()`. Follow the existing success/failure pattern for async operations.
- Reducer: `createFeature` + `createReducer` + `@ngrx/entity` adapter. The `DocumentsState` extends `EntityState<Document>` with `selectedDocumentId`, `loading`, `error`.
- Selectors: Destructure from `documentsFeature` and `adapter.getSelectors()`. Compose with `createSelector`.
- Effects: Class-based `@Injectable()` with `inject(Actions)`. Wrap async calls in `from()`. Use `{ dispatch: false }` for side-effect-only effects.

## Storage Architecture

**localforage** wraps IndexedDB with two stores under DB name `'epub-pdf-reader'`:
- `documents` store — raw file `Blob`s keyed by UUID
- `metadata` store — serialized `Document` objects keyed by UUID

`deleteFile()` removes from both stores. Reader settings (epub) are stored separately in **localStorage** (key: `'epub-reader-settings'`).

## Library Dependencies

| Library | Import style | Notes |
|---------|-------------|-------|
| `epubjs` | `import ePub from 'epubjs'` (default) | Used only in `epub-reader.component.ts`, NOT in `epub.service.ts` |
| `pdfjs-dist` | `import * as pdfjsLib from 'pdfjs-dist'` (namespace) | Worker loaded from CDN at runtime in `pdf-reader.component.ts` |
| `localforage` | `import localforage from 'localforage'` | All methods are Promise-based (no Observable wrappers) |

## Testing

- **Framework: Vitest** (not Karma/Jasmine). Run with `npm test` or `ng test`.
- Uses `vitest/globals` types — `describe`, `it`, `expect` are globally available.
- Tests use standard Angular `TestBed` with standalone components in `imports: [...]`.
- Currently only `app.spec.ts` exists — when adding tests, follow the same `TestBed.configureTestingModule({ imports: [ComponentUnderTest] })` pattern.

## Routing

Three eagerly-loaded routes in `app.routes.ts`:
- `''` → redirects to `/library`
- `'library'` → `LibraryComponent`
- `'reader/:id'` → `ReaderComponent` (reads param via `ActivatedRoute.snapshot`)

No lazy loading is used. Add new feature routes in `app.routes.ts`.

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm start` (port 4200) |
| Build | `npm run build` |
| Tests | `npm test` |
| Watch build | `npm run watch` |

## When Adding New Features

1. Define any new interfaces/types in `core/models/`.
2. Add NgRx actions, reducer cases, effects, and selectors in `store/documents/` (or create a new feature store under `store/`).
3. Create standalone components under `features/<feature-name>/` with external template and CSS files.
4. Wire new routes in `app.routes.ts`.
5. The roadmap in `roadmap.md` lists planned features — consult it for context on upcoming work.
