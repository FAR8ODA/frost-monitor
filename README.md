# Frost Monitor

my React + TypeScript screen that helps a grower spot frost risk across their farm, built against the provided mock API.

> **Time spent:** about 2h 25m on Wednesday (7:09 pm to 9:35 pm) for the implementation, tests and this README, plus about 20 minutes the night before setting up the environment (Node, Vite, Vitest). Under the 3 hour limit.

---

## Quick start

we would need Node 20.19+ (built with Node 26).

| Task | Command |
| --- | --- |
| Install | `npm install` |
| Run the app | `npm run dev` then open `http://localhost:5173` |
| Run tests (watch mode) | `npm test` |
| Run tests once | `npx vitest run` |
| Type-check and build | `npm run build` |
| Lint | `npm run lint` |

`src/api/mockApi.ts` is committed exactly as provided, including `FAILURE_RATE = 0.05`. Setting it to `1` locally shows the error state.

---

## What the grower sees

| Question | Where it's answered |
| --- | --- |
| Which fields are at frost risk right now? | Overview table, at-risk fields sorted to the top with a "Frost risk" badge, a "2 of 8 fields at frost risk" summary, and a filter to show only at-risk fields |
| Is it getting colder or warmer in a field? | "Trend vs last week" column, on every field and every station |
| Which stations are coldest, and are any offline? | Detail panel (click a field): stations sorted coldest first, an "Offline" badge, the 7 daily lows with frost days highlighted, and an offline count per field in the overview |

With the provided data: **South Slope (-3 °C)** and **River Flats (-2 °C)** are at risk. **Creekside (0.5 °C)** is the closest call. River Flats, Creekside and West Gate each have offline stations.

---

## 1. Architecture

```text
src/
  api/mockApi.ts      provided backend, unchanged
  frost.ts            all frost rules as pure functions (no React, no network)
  useAsync.ts         loading / error / success state with retry
  App.tsx             loads data, renders the overview, owns UI state
  FieldDetail.tsx     station detail for the selected field
  App.css, index.css  styling
  test/               all tests
```

**Data flow:** `mockApi` → `loadFarm()` → `summarizeFarm()` → `useAsync` state → `App` / `FieldDetail`

| Decision | Why |
| --- | --- |
| Frost rules live in `frost.ts` as pure functions | Testable without React or the network, one place to change a rule, reusable outside this screen |
| One load for the whole screen: fields + stations in parallel (`Promise.all`), then 14 days of readings | Small data set, so switching fields is instant with no second loading state. 14 days = 7 for frost risk + 7 before them for the trend |
| Async state is a union (`loading` / `error` / `success`) | The UI can never be "loading and errored" at the same time, and TypeScript only allows `data` when it exists |
| Only two pieces of UI state (`selectedId`, `onlyAtRisk`) | Everything else (sorting, filtering, counts) is derived during render, so nothing can drift out of sync |
| View types (`FieldSummary`, `StationSummary`) built on the API types | Components receive ready-to-display data and stay simple |
| Flat file structure | The separation of concerns is in the files, not in folders. Five source files didn't need more nesting |

**Build order:** frost logic → logic tests → data hook → overview with loading, error and empty states → detail panel → component tests → cleanup → README.

**Deliberately left out:** a charting library (7 numbers + a trend arrow answer the question), routing and URL state, a data caching library, responsive layout tuning, and visual polish beyond clarity.

---

## 2. Edge cases and assumptions

| Situation | How it's handled |
| --- | --- |
| Frost threshold | `0 °C or below` is inclusive, so exactly 0 °C counts as frost |
| "Last 7 days" | `AS_OF_DATE` minus 6 days through `AS_OF_DATE` inclusive (Jan 9 to Jan 15). The computer clock is never used |
| `null` readings | Skipped when computing the coldest low and averages. Shown as `n/a` in the daily lows so gaps stay visible |
| Station or field with no reports this week | Shows "No data" and is **not** flagged at risk. Missing data isn't evidence of frost. A real product should show a separate "insufficient data" warning |
| Offline station | No reading on `AS_OF_DATE` **and** none the day before. The farm-wide gap 3 days ago doesn't count as offline |
| Trend | Average daily low this week vs the 7 days before. A change under 0.5 °C is "Steady". "No data" if either week has no reports |
| Slow responses | "Loading farm data..." message announced to screen readers (`role="status"`) |
| Failed requests | Any failed call fails the load and shows the error message with a **Retry** button that reruns all calls. With 3 calls at 5% each, about 1 load in 7 fails, which matches the brief |
| Late responses | `useAsync` ignores a request's result if it's no longer the current one, so an old response can't overwrite newer data |
| Empty states | No fields, a filter that hides every row, and a field with no stations each show a message instead of an empty table |
| Sorting | At-risk first, then coldest first. Fields and stations with no data sort last |

**Feedback on the mock API** (left unchanged as instructed):

- A per-field summary endpoint (coldest low, risk, offline count) would avoid shipping every reading to the client.
- Errors carry only a message. A status code or a "retryable" flag would let the UI decide when retrying makes sense.
- Dates are UTC day strings. Real frost data should follow the farm's local day, since lows happen overnight.

---

## 3. Scale and reuse (500 fields, 20,000 stations)

| What breaks | Why | What I'd change |
| --- | --- | --- |
| Initial load size | 20,000 stations × 14 days = 280,000 readings on every page load | Server-side summary endpoint for the overview. Fetch a field's station readings only when it's opened |
| `getReadings` request | 20,000 station ids in one call | Query by `fieldId` instead of station ids |
| Client computation | Filtering readings per field and per station is roughly fields × readings | Group readings by station once in a `Map`, or move aggregation to the server |
| Rendering | 500 rows, and fields with hundreds of stations | Pagination or list virtualization, plus search by field name |
| Reliability | More calls means more chances for one failure to blank the whole screen | Separate loading and error states per section, retries with backoff, and caching with TanStack Query |
| Filtering and selection | All done in memory, lost on refresh | Server-side filter and sort, with the selected field and filter stored in the URL |

**Shared component library candidates**

| Component | Reuse |
| --- | --- |
| `StatusBadge` (risk, ok, offline) | Any status that needs text + icon, never colour alone |
| `LoadState` (loading, error + retry, empty) | Every data-driven screen |
| `DataTable` | Accessible table with headers, captions and sortable columns |
| `DailyValues` / sparkline | Any per-day metric (temperature, humidity, pest counts) |
| `useAsync` | Shared fetching pattern, or replaced by TanStack Query |

The frost rules and field/station views stay in this app since they're domain-specific.

---

## 4. Testing

**10 tests across 3 files, all passing.**

| File | Type | Covers |
| --- | --- | --- |
| `frost.test.ts` | Unit + real data | Exactly 0 °C counts as frost, 0.5 °C doesn't, the day just outside the window is ignored, nulls are skipped, no data returns `null` not `Infinity`, offline needs both days missing, the 0.5 °C trend threshold. One test runs the **real mock API** and checks the full 8-field ranking |
| `App.test.tsx` | Component | A failed load shows the error, Retry recovers, the at-risk field is listed first with a text badge, clicking a field opens its detail, and the filter hides safe fields |
| `mockApi.test.ts` | Unit | The 7-day window math and month boundaries |

**Why these:** the riskiest code is the frost logic, and its bugs hide at boundaries (the exact threshold, the window edge, missing data), so those get targeted tests. The real-data test confirms the rules produce the expected answer for this farm. The component test follows the main user story, including the failure path the brief emphasizes, and finds elements by role so it also checks the accessibility basics.

Randomness is controlled so tests never flake: the component test fakes the three API calls, and the real-data test pins `Math.random` so the API never fails during the test.

**Next with more time**

- A test for fast field switching and unmounting mid-load (the late response guard)
- A keyboard-only test of the full flow with `userEvent.tab()`
- Automated accessibility checks with axe
- Assertions on the loading state using a delayed promise
- An end-to-end test (Playwright) against the real mock API

---

## Accessibility

- The frost risk and offline badges use **text and an icon**, never colour alone
- Real `<table>` markup with column and row headers and a caption
- Field names are `<button>`s with `aria-pressed`, so Tab, Enter and Space work, with a visible focus outline
- Loading uses `role="status"` and errors use `role="alert"`
- The filter checkbox is wrapped in its `<label>`, and decorative icons are `aria-hidden`

---

## AI usage

I used AI throughout, and chose models deliberately to stay efficient with token usage.

| Tool | Used for |
| --- | --- |
| Claude (Sonnet) | Breaking down the brief, laying out the skeleton and data flow, and planning the build order |
| Claude (Opus) | Drafting the frost logic, tests, data hook and components, debugging environment issues, and reviewing fixes |

**Where the AI output wasn't what I wanted, and how I fixed it**

| What happened | How I noticed | Fix |
| --- | --- | --- |
| The first suggested structure split the code into `logic/`, `hooks/` and `components/` folders | For a time-boxed screen with five source files, the nesting added navigation without adding clarity | Flattened to `src/` and kept the separation at the file level |
| The generated tests assumed they'd sit next to the source files | After I moved all tests into `src/test`, TypeScript showed a cascade of "implicitly has an any type" errors | Traced it to broken relative imports, not the test code, and fixed the paths to `../` |
| Expected values in the tests (-3, -2, 0.5 °C) came from the AI | I didn't want to trust numbers I hadn't checked | Cross-checked them against the mock API's formula and the running app before relying on them |

**What I did by hand**

- Wrote and edited the frost logic line by line, and wrote the code comments
- Made the final calls on the assumptions above (null handling, offline rule, trend threshold)
- Manually tested the error state, the retry flow, keyboard-only navigation, and every value in the overview
- Organized the tests and wrote the commit history

---

## What I'd do next

- A small sparkline chart per station instead of the number strip
- Selected field and filter stored in the URL so views can be shared
- Day boundaries in the farm's local time zone
- Dark theme: added as a small stretch after the core was done. Next I’d default it to the system setting and remember the choice
