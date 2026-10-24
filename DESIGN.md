# Fermata design system

Read this before building or changing any screen. It describes the UI as it is built in
`src/app/globals.css` and `src/components/`. When the code and this file disagree, fix one of them
in the same change.

## Character

Calm, exact, warm. Fermata is a finance tool that holds only where it should, so the interface is
quiet by default and loud only where something needs a person:

* **Cream, not white.** Pages sit on a warm cream canvas; cards are white on top of it.
* **Navy for what you read, blue for what you do, amber for what waits.** No other colours carry meaning.
* **Two colours with jobs, everything else neutral.** See the rule under Colour.
* **Numbers are the heroes.** Big figures in the display face, tabular, counting up when they change.
* **Everything that moves has a reason.** Motion shows arrival, progress or a hold, never decoration.
* **The fermata mark 𝄐 means held.** Use it only for held or waiting-on-a-person states, and for the brand.

## Colour

All colours are tokens in `@theme` in `globals.css`. Use the Tailwind names (`bg-canvas`,
`text-heading`, `border-hairline`…), never raw hex in components.

| Role | Token | Use |
| :--- | :--- | :--- |
| Canvas | `canvas` #fdfcfa | Page background |
| Surface | `ground` #ffffff | Cards |
| Warm surfaces | `well` #f9f7f1 · `warm` #f8f1ea · `inset` #f1e8df | Panels, frames, tracks, segmented controls |
| Hover | `hover` #f4eee6 | Hover fill on ghost controls and rows |
| Lines | `hairline` #e9ddd1 · `strong` #e0d0c1 · `mute` #cfbba8 | Borders, hovered borders, neutral bars |
| Text | `ink` #272320 · `body` #3f3a34 · `secondary` #5f564d · `faint` #897d71 | Primary, body, supporting, labels |
| Headings | `heading` #0a2d66 · `heading-2` #0f3d7a · `night` #0b1d3a | Display and titles; footer; top notice bar |
| Action and data | `accent` #1f5fc0 · `accent-hover` #17499a · `accent-tint` #eaf1fb · `link` | Buttons, links, active tabs, charts, selected states |
| Brand second colour | `cyan` #17bebb | Only the brand button's tab. Never for meaning |
| Hold | `hold` #b27d10 · `hold-tint` #fbf0d6 · `hold-tint-strong` | Held, needs an answer, waiting on a person |
| Success | `success` #2e9e5b · `success-tint` | Settled, passed, on the console's working screens. Not in the dashboard window or Ask |
| Danger | `danger` #d23b30 · `danger-tint` | Blocked, denied, wrong |
| Info | `info` #00a3a0 · `info-tint` | Approved but not yet posted (console); the orb's working states |

Shadows are warm (`rgb(85 40 20 / …)`), never grey-black.

**Two colours with jobs, everything else neutral.** A screen gets two colours that mean something, and nothing else
competes with them:

* **Accent (blue)** is what you can act on and what the data draws: the active tab or nav item, links, buttons, and data
  lines and marks (a bar for the bank, a trend line, a learned rule's pill on a chart).
* **Hold (amber)** is only what needs a person: the 𝄐, the one amber card (Waiting on you), a held count, a dot on a
  month that still holds a question, a question waiting for an answer.
* **Everything else is neutral:** `ink`, `secondary`, `faint`, `inset`, `mute`, `hairline`. A row that is simply done gets
  no mark (when every row is done, a ✓ carries no information). Source pills (Claude, Code, Scripted, Story) are the same
  quiet neutral `Pill`. Avatars are one tile (`inset`, ink initials), not a colour each. Settled, closed, approved, answered
  and passed are neutral pills or plain text, never green. Calls to action inside a card are text links, not tinted pills.
* **Red is the one exception**, kept for a real refusal or denial (a blocked step, a denied transition), always with its reason.
* Success green and info teal stay in the palette for the console's working screens, the demo's case rooms and the orb's
  states; the dashboard window and Ask the books do not use them. New screens start from this rule.

## Type

Three faces, loaded in `layout.tsx`:

* **Manrope** (`--font-display`): headings and figures.
* **Inter** (`--font-sans`): everything else. Body is 14px, line height 1.45, tracking −0.01em.
* **IBM Plex Mono** (`--font-mono`): numbers in tables, ids, code, eyebrows, traces.
* **Noto Music** is a fallback in every stack so 𝄐 always renders.

Type roles are classes, not ad hoc sizes:

| Class | What it is | Typical size |
| :--- | :--- | :--- |
| `.display` | Page titles and hero figures. Navy, weight 500, tracking −0.04em | `clamp(34px,4.6vw,52px)` titles; up to `clamp(56px,9vw,104px)` for a hero number |
| `.title` | Section and card headings. `heading-2` navy | 22–34px |
| `.figure` | Metric values. Tabular | 28px mobile, 34px desktop |
| `.eyebrow` | Mono, 11px, uppercase, `faint`. Labels above figures and sections | 11px |
| `.num` | Any number in running text or tables. Mono, tabular | inherit |

Sentence case everywhere. Plain words on screen (stores, rules, held, settled); internal ids only
inside rule code and the record.

## Surfaces

* `.card` (`Card`): white, hairline border, radius 10px, soft warm shadow. Padding `p-5 lg:p-6`.
* `.frame`: a warm tray (radius 16px, 6px padding) that holds one or more cards. Use it to group
  a hero card with its supporting cards.
* `.panel`: a flat warm well (radius 6px) for traces, code and evidence inside a card.
* `.hatch`: diagonal hatching on canvas for empty states and "nothing here yet".
* `.scroll-quiet`: put it on every scroll box inside a card. The scrollbar is thin and stays invisible until the box
  is hovered. Lists that stream in (the demo's engine) do not scroll at all: they clip with a fade at the bottom.
* `.field`: a text input or select. White, hairline border, radius 6px, blue border when focused, 44px tall on
  mobile and 36px on desktop. Its label is an `.eyebrow` above it.
* `.coach`: the one dark card on the site pages, warm graphite (`ink`) with a faint grain, white text, radius 16px. Only
  for teaching the Ask the books shortcut (the popup while it listens, and the landing page's lesson). Opaque: the
  page's dark headings show through any translucency.
* `.kbd`: a key or a shortcut ("⌃ + ⌥") in mono, light on the page and frosted inside `.coach`. `TalkKeys` renders the
  Ask the books shortcut named for the platform.
* Radii: card 10px, panel 6px, button 4.5px, pill fully round. Nothing else.

## Components (`src/components/ui.tsx`)

* **`PageHead`**: every page starts with one. Optional neutral `Tag`, a `.display` title, one line of
  supporting text, actions on the right on desktop.
* **`Button`**: `primary` is the brand button (navy face over a cyan tab that widens on hover; the
  label stays put). Use at most one primary per view. `secondary` is the default, `ghost` for
  low-emphasis actions, `hold` for actions that answer a held item. Minimum height 44px on mobile,
  36px on desktop.
* **`LinkArrow`**: inline navigation; the arrow slides out and a copy slides in on hover.
* **`Pill`** with tones `neutral · accent · hold · success · danger · info`. **`StateBadge`** maps
  work states to words and tones (Held and Needs an answer get the 𝄐).
* **`Tag`**: a rounded label above a title.
* **`Metric`**: eyebrow, figure, optional sub line. Hold and success tones colour the figure.
* **`Bar`**: 6px progress track on `inset`, animated width.
* **`Trace`**: mono lines in a panel, each with its kind and whether it was **real, scripted or
  staged**. Denied lines are red. Every agent output on screen says which of the three it was.
* **`Loading`**: a breathing amber 𝄐 with a short line of text. No spinners.
* **`Splash`** (`motion.tsx`): the run view's cold load. The 𝄐 alone in a white tile on the canvas, shown at least 700ms,
  then the whole screen fades into the page. Only on a cold load; returning to the page skips it.
* **`Arrival`** (`motion.tsx`): wraps the landing page and the demo. The same splash once per visit, on the first page
  opened, with the page hidden underneath so its own entrance plays as the splash fades. Client navigations skip it.
* **`.tip`** (`globals.css`): a small `night` bubble with an arrow (`data-arrow="up"` or `"down"`, `--tip-x` to move
  it). Inside a `.has-tip` element it is a tooltip, shown on hover and keyboard focus (the header's GitHub icon); on its
  own it is a hint (the demo's).
  Icon-only controls still carry an `aria-label`; the tip is `aria-hidden`.
* `AGENT_LABEL` gives every role its display name; use it rather than writing names by hand.

## Case rooms (`src/components/caseRoom.tsx`)

The transcript of the agents' meeting on one held story.

* **One row per message:** a 36px initials tile (`IN`, `AU`, `LE`, `EN`, `MG`), then the name, a source pill
  (`Claude` accent, `Code` neutral, `Scripted` neutral) and `→ addressee` in `faint`.
* **Findings** sit in a `.panel` as mono lines starting `›`. **Queries** an agent ran are a `<details>` row
  ("ran name(input) · n rows"), closed by default. **Draft rules** are a `bg-night` code block.
  A **proposed question** is a light amber box.
* **Manager lines** are short rows with the `MG` tile and `secondary` text; the manager only appears when it
  enforces something.
* **Refusals** are a `danger-tint` block, indented to the text column, titled "Blocked by the gateway".
* **Following the newest message:** use `scrollBoxToEnd` (`motion.tsx`), never `scrollIntoView`, which also scrolls
  the page and makes it jump every time an agent speaks.
* **Working** agents show a breathing amber dot and "working", and their queries appear as they run.
* The room header shows the turn count ("Turn n of 6") and the room state: In meeting (accent, breathing),
  Asked (hold, 𝄐), Closed (success).

## Landing page and public demo (`src/app/page.tsx`, `src/app/demo`, `src/components/landing.tsx`)

* `/` is the site; `/dashboard` is the overview; `/demo` replays a recorded run; `/pitch` is the deck; the console lives at `/run`, `/stories`, `/rules`,
  `/evaluation`, `/record`, `/scenarios`, `/whatif`. The header switches: on the site pages (`/`, `/dashboard`, `/demo`, `/ask`) it is two
  links (How it works, Dashboard; plus Console when run locally), the GitHub icon and the **Watch the live demo**
  button, last and the only primary; on `/demo` itself the button drops out, because running the demo is the action
  there. Console tabs and the Acting as switch everywhere else. Two paths, no more doors: the guided path is the demo,
  the explore path is the dashboard (Ask the books lives inside it), and the demo hands off to the dashboard when the
  year closes. Ask the books is also everywhere on the site pages as a shortcut (hold ⌃ + ⌥; see Ask the books,
  anywhere), which adds no header link. `/ask` still works as a direct address; the footer lists every way in.
* The landing page follows one rhythm: a `Tag`, a `.display` or `.title` heading, one short paragraph, then a
  `LinkArrow`. Illustrations sit in a `.frame` around a `.card`.
* **How it works is pinned** (`HowItWorks` in `landing.tsx`): on wide screens the whole stage (title, card,
  description) is pinned while the page scrolls through a tall track, and how far through the track you are picks the
  beat. All three swap together, so only one beat is ever on screen. The card opens out of a strip as the section
  arrives (a scroll-linked `clip-path`, smoothed with a spring), its rows cascade in (`.cascade`), and dots track and
  jump between beats. The section resists lightly: inside it every scroll carries the page about two thirds as far (`RESIST`),
  each beat takes `STEP` screen heights, and the last beat holds only a short `TAIL` before the page lets go, so the
  whole section takes about three screens of scrolling. `RESIST` 0.45 with a full last step felt stuck. The
  card gives under the push (it lags against the scroll and dips, then springs back). When a scroll slows between
  beats it glides on to the next one, with leftover momentum swallowed so the glide lands; a really fast fling still
  carries all the way through. On narrow screens the beats stack.
* **The landing page scrolls with Lenis** (`SmoothScroll` in `motion.tsx`): eased, slightly weighted scrolling that gives
  the page its friction. Use `withLenis` to hook into it, `addScrollGate` to hold the page still for a section, and
  `scrollToY` to move the page. The landing page hides its scrollbar while Lenis runs. Both are off under reduced
  motion, where the page scrolls natively. Do not add CSS scroll snap on top of it.
* **Every number on the site comes from the recording** (`src/demo/recording.json`, written by
  `scripts/export_demo.ts`), or for learning from the learning year (`src/demo/learning.json`, through
  `src/components/learningYear.ts`). Never type a figure into the page by hand; read it from the data.
* **Ask the books on the landing page** sits between How it works and Proof and teaches the shortcut rather than
  embedding the panel: the page rhythm on the left (`Tag`, "Ask the books. Out loud.", one paragraph, then four
  suggested questions as chips that open the popup and ask), and on the right, in a `warm` tray, the idle orb over a
  still `.coach` card ("Hold ⌃ + ⌥ to ask the books anything", one question to say aloud, Type instead). The hero carries
  one quiet line under its buttons, "or hold ⌃ + ⌥ to ask the books", which opens the popup ("or ask the books" on a phone).
* **The landing page's learning sections:** the banner states the learning claim (how many times fewer lines are left for
  people with learning, rounded down, then both year-end counts in a quieter line); **Proof** is a white card with a
  `Tag`, a `.title`, one paragraph, four figures (a figure can carry a `faint` sub line, the without-learning number) and
  the `LearningChart` across the full width; **Trust** ("What if it gets one wrong?") follows the page rhythm with the
  learned rules in a `.frame` beside it, each with its backtest and per-payment limit.
* **US dollars beside headline rupiah** (`usdApprox` in `src/components/money.ts`): one fixed, approximate rate of
  Rp 16,000 per dollar, rounded to two significant figures, in `faint` after the figure: "−Rp 48.6bn (about $3M)". Headline
  figures only, never table rows, and never inside the product window (the dashboard stays in rupiah, as the
  business would see it). Where Shopee and Tokopedia first appear on the page, say once what they are (Southeast
  Asia's Amazon and eBay).
* The demo does not call itself a recording on screen, but it never claims more than it is: every agent message
  inside a room keeps its Claude, code or scripted label, and answers the recording did not take are greyed out.
* **The demo ends in the closed books.** When the year closes, the case rooms card ends with the hand-off: the brand
  button **Explore the closed books** (`/dashboard`), **Ask the books** (opens the popup over the closed year), a faint
  line teaching the shortcut ("Anywhere on the site, hold ⌃ + ⌥ to ask the books", keyboards only), and Run it yourself as
  a quiet text link. Play again steps down to a secondary button so the hand-off is the one primary. The demo never
  embeds the dashboard; it sends the visitor there.
* **Hints only for a visitor who hesitates** (`useHints`, `Hint` in `demo/page.tsx`, drawn as `.tip`). Each waits for
  a pause with no click or key (any click or key restarts the wait): Close the year after 3.5s idle (the splash counts),
  the question card after 5s (under its scroll box, so it shows however far the options run), the hand-off after 3s at
  the close, and the engine stream after a mouse lingers 1.5s without clicking. One at a time, each at most once per
  visit, never over the agents' transcript, never taking a click, and gone the moment the visitor acts or the phase
  moves on. `?tips=off` turns them off for the visit, for recording. Hint copy never calls the demo canned,
  recorded, scripted or a replay.
* Grid children that hold truncating text need `min-w-0`, or they push the page wider than the phone.

## Dashboard (`src/components/dashboard.tsx`, `/dashboard`)

The product as an app window: the landing page's hero and the calm overview page at `/dashboard`. It reads only the
recording, so it works on the hosted site with no Convex, and a re-export updates every figure.

* **Two colours with jobs** (see Colour): blue for the active tab, links and data; amber for what waits on a person;
  everything else neutral. The window provides `PlainAvatars`, so every `Avatar` and @mention inside it (the case room
  transcripts too) is the one neutral tile; room states, rule states (`StateBadge quiet`), audit results and the
  recorded answer are neutral, except held (amber) and blocked (red).
* **A window, not a page.** A `.frame` around one `.card` split into a `well` sidebar (the 𝄐 Fermata wordmark, the
  fictional company, the console tabs with counts, and who is acting) and a `canvas` main area. On a phone the sidebar
  folds into one bar across the top of the window.
* **Three metric cards** (`.card`, eyebrow, `.figure` that `Roll`s, one sub line, then a small picture pinned to the
  bottom so the three line up): the head office cash the bank holds against what the books claimed (struck through in
  `faint`; the bank bar is accent, the books bar `mute`), the first pass share by month as a sparkline that draws in with
  `pathLength`, and the close as twelve `mute` month bars with an amber dot under each month that still holds a question.
  "Closed through Dec" in the head is a neutral pill.
  On a phone each card puts its picture beside the figure instead of under it. The first pass card ("Settled on its
  own") states the recorded year as it happened and says nothing about why it rose; the learning claim lives in the
  comparison (see Honest claims about learning).
* **Agent activity:** one row per role: the `Avatar` (neutral), the `AGENT_LABEL` name and what it did, a mono uppercase
  sub line, and a neutral pill saying where the work came from (Claude or Code). No ✓: every row is done. A red ✕ leads
  the row only when the recording has a refusal. The summary doesn't count scripted work; the case rooms label it. Counts are computed from the rooms, rules and months, never typed.
* **Waiting on you** is the one amber card: a `hold-tint` header with the 𝄐, open questions grouped by the person
  asked, the largest first, each with a quiet `Review` text link (blue, not a tinted pill). A person with nothing open says so and shows their last answer.
* **Honest by construction:** a figure the recording does not hold is left out rather than invented (there is no
  monthly cash series, so cash is a bank against books comparison, not a sparkline).
* **Views switch inside the window** (`src/components/dashboard/*`). The sidebar is a `tablist`: choosing an item swaps
  the content area in place, with a sliding highlight (`layoutId`), and nothing in the window navigates away. Dashboard is
  the overview; Case rooms lists every room by month (live rooms marked Claude, other narrated ones by story letter) and
  opens a room's transcript (`ChatList`) beside its question and recorded answer; Rules shows each rule's source,
  backtest, audit and code; Run, Evaluation and Record are one card each (what the screen is, a real preview where the
  recording has one, a link to the demo and, off the hosted site, to the console). A Review link opens its room.
* **The window keeps its size.** On wide screens the overview sets the height and every other view sits over it and
  scrolls inside (`data-lenis-prevent`, so the landing page's smooth scrolling leaves it alone). On a phone the views
  are a row of tabs that scrolls sideways inside the window, and each view takes its own height, because a scroll box
  taller than the screen traps the finger.
* `/dashboard?view=rules` (or `case-rooms`, `run`, `evaluation`, `record`, or `room=<key>`) opens a view, and the address
  follows the window there. The landing page's hero keeps its view to itself. Add a view with one entry in `VIEWS` in
  `dashboard.tsx`.

## Scenarios (`src/app/scenarios`, `convex/scenario.ts`)

The console screen for "try a case of our own": inject bank lines into the closed year and let the real engine, agents
and people handle them. Console only; every write takes the console key.

* **Four presets in a `.frame`**, one `.card` each (new lender, the same with the CFO saying no, a deposit no store
  recorded, a dealer paying open invoices). Each card: an `.eyebrow` name, one line saying what should happen, its
  fields (`.field` with an eyebrow label; stores are small toggle chips, `aria-pressed`), then a secondary **Inject**
  button and who answers. No primary button on this screen: injecting is a tool, not the call to action.
* **Injected** lists each scenario newest first, as a `.frame` around a `.card`: a neutral pill with its kind, the
  month and its id, a `.title`, the expectation, outcome pills (settled green, held amber with 𝄐), then two `.panel`s:
  the case room (room state pill, the question, the answer, the resolution, `LinkArrow` to the room) and the rule
  (id, state, Claude or scripted, backtest). The lines sit in a `<details>` with a `.scroll-quiet` list.
* **Reset scenarios** is a secondary button in the page head; its result is one faint line under it.
* Scenario items carry a neutral **Scenario** pill wherever the year's own screens show them (case rooms, rules,
  record). The year's figures on Run leave scenario rows out; Ask the books never sees them.

## What if (`src/app/whatif`, `src/app/api/simulate`)

A console screen for what-ifs: knobs for the generated world, then the real engine over the year twice, learning and
with the rules frozen at onboarding. A route handler runs it on the local server (no Convex, no Claude); the hosted
site redirects it to the demo like the rest of the console.

* **Knobs in one card inside a `.frame`**, grouped under eyebrows (World, the off-by-default card fee knobs, New lender,
  Learning). Number fields are the record page's field (hairline border, `focus-within:border-accent`), months are a
  plain select, the world is a segmented radiogroup, stores are pressed toggles (`aria-pressed`, accent when on).
* **One chart, two lines:** the shared `LearningChart` (see Learning comparison chart). Learned rules are also accent pills
  under it. Below it four `Metric`s; year-end held is the hold tone.
* **The month table and what it learned** sit side by side on wide screens. Each learned rule shows who answered and
  that the answer came from the answer key, a `Code` pill (never Claude: the simulator's Learner is code), and its fit
  and backtest as `›` lines in a `.panel`. Rules that failed to fit or failed their backtest are listed in red.
* Every number on the screen comes from the run; the source line repeats that the Learner here is code.

## Learning comparison chart (`src/components/learningChart.tsx`)

`LearningChart` draws the learning claim: one year run twice on the same engine, once learning from people's answers and
once with the rules frozen at onboarding, as the share settled on first pass by month. One component for the landing
page's proof, the pitch's Self improving slide and the What if screen, so the comparison reads the same everywhere.

* **Learning** is `accent`, solid, with white points. **Without learning** is `mute`, dashed. Each line ends in its
  December share (accent and `faint`).
* **Learned rules:** a `hold` 𝄐 (Noto Music) sits over the learning point of each month in which an answer became a
  rule, and that month turns `accent` on the axis. This is the demo curve's mark, "an answer became a rule".
* **A small legend** above (With learning, Without learning, 𝄐 An answer became a rule) and **the caption** under it,
  always: "Simulated on the same engine: the same year, with and without learning." (`SIM_CAPTION`).
* Three widths keep its labels near 11px: a phone chart below `sm` (single letter months), a mid one, and a wide one
  from `lg`. `stage` draws only the mid one, for the pitch, which scales it with CSS `zoom`.
* Both lines draw in left to right behind a growing clip the first time it scrolls into view (not `pathLength`, which
  would overwrite the baseline's dashes).
* Feed it `{ months, learned }` per run: a run from `/api/simulate`, or `src/demo/learning.json` through
  `src/components/learningYear.ts`.

## Pitch deck (`src/app/pitch`, `src/components/pitch`)

`/pitch` is the deck for the Devpost video and any live pitch. It is a page of the app, not a slide file, so it
uses the same tokens, type classes, components and motion as the screens it introduces.

* **A fixed 1920×1080 stage**, scaled to fit the window and letterboxed on `inset`. Write slide sizes in px for
  that canvas (no `clamp` or `vw`). It covers the header and footer while open.
* **Keys:** → / space step through a slide's builds, then the slides; ← goes back; `N` shows the spoken script;
  `F` full screen; `H` hides the slide counter for recording. `#n` in the URL opens slide n.
* **One idea per slide.** A slide is a `Frame` (chapter eyebrow top left, the mark and page number below), a
  `.title` heading in sentence case, then one visual. Chapters use the judges' words (Why, How it works,
  Case rooms, How it's built, Self improving, Proves every step, The result).
* **Every figure comes from the recording or the learning year** through `pitch/data.ts` (`D.learning` is
  `learningYear.ts`); assumptions (minutes per match, per decision) are printed on the slide that uses them. Something
  not yet measured shows a `.hatch` placeholder, never a typed number. Spoken notes that quote a figure interpolate it
  from `D` too.
* **Self improving** is the `LearningChart` (stage size, `zoom`) under the first pass and the lines left for people,
  with and without learning. It never draws the recorded year's curve.
* **Builds** use `In` (rise with a short blur, optional delay, or shown from a build step). Charts draw in with
  `pathLength`; numbers `Roll`.
* App components scale with CSS `zoom` (the case room transcript, avatars, pills) rather than being copied.

## Motion (`globals.css`, `src/components/motion.tsx`)

| Name | Use |
| :--- | :--- |
| `.calm` | Default transition for colour, border, shadow, opacity, transform: 300ms `--ease-brand` |
| `.enter` | Content appearing on load: 400ms rise from 12px |
| `.arrive` | A live row that arrived after first paint: slides in with a brief blue tint |
| `.breathe` / `.breathe-dot` | Something is waiting on a person (amber pulse) |
| `.draw` | Lines and charts drawing in |
| `.rise` | Fade in, used by `BrandGrid` cells |
| `.cascade` | The rows of a picture arriving one after another (the pinned how-it-works card) |
| `Count` / `useTween` | Live Convex numbers count toward their new value instead of jumping |
| `Roll` | Headline figures: digits roll to the new value (NumberFlow), starting from zero the first time they are on screen |
| `Reveal` / `RevealItem` | A group whose children rise in with a short blur, one after another, the first time it scrolls into view |
| Sliding highlight | A `motion` `layoutId` background that slides between options, e.g. the current month on the run view |
| `useLive` | Only rows that arrive after first paint animate |
| `BrandGrid` | Stepped blue cells at the edges of a hero, clearing toward a readable centre. `top` hangs it from the top edge: the landing page uses one full-width band behind the header and headline, and nowhere else on that page (not in the banner, behind the hero window or in the How it works card) |
| `ThinkingOrb` | Ask the books' voice: a point sphere that rests, listens, works and speaks (see Ask the books). Blue only |

Component motion uses `motion/react`; CSS classes stay for anything that does not need it. Patterns are ported from
Watermelon UI (ui.watermelon.sh) into our tokens, never installed as-is, because its blocks carry their own colours.

Easings: `--ease-brand` for most things, `--ease-out` for entrances, `--ease-spring` only for small
toggles (the menu icon), `--ease-exit` for leaving. Everything is disabled under
`prefers-reduced-motion` (`MotionConfig reducedMotion="user"` in `providers.tsx` covers `motion`); new animations must respect it too.

## Layout

* Content width 1440px (`max-w-page`, the `--container-page` token; the console header card is 60px narrower so it lines up), gutters `px-4` mobile and `lg:px-10` desktop.
* **Workspaces that play over time** (the demo) have a fixed height on wide screens and scroll inside each panel, so the page
  stays still while they run. Starting the run scrolls the page once to bring the whole workspace into view.
  In the demo, a meeting takes the workspace: the engine column (paused) collapses so the transcript gets the width,
  and the question takes the right column beside it, never under it, because the agents' conversation is the point.
  The columns resize with a `grid-template-columns` transition; spacing lives inside the columns so a 0px column
  leaves no gap.
* The desktop/mobile switch is `lg` = 1025px and up. Design mobile first; no horizontal page scroll.
* Header: a navy notice bar ("every store, amount and person here is synthetic"), then a floating
  white header card with the 𝄐 Fermata wordmark, the tabs (`nav.ts`), and the Acting as switch
  (Accountant / CFO). On the site pages the card hugs its contents and sits centred (wordmark, two links, the GitHub
  icon, the demo button, with modest gaps), never stretched to the page; the console's card keeps the page width
  (60px narrower) for its six tabs and the switch. On mobile both are full width and the links fold into a menu.
  The bar and the card stick to the top as one unit, so the header never moves when you scroll or jump
  to an anchor; give anchor targets `scroll-mt-36` so they land below it.
* Footer: navy, a large faint 𝄐, the tagline, the screens, and the synthetic-data line.
* Tabs live in `src/components/nav.ts`; add a screen there once and the header and footer pick it up.

## Rules that carry the product

* **Every number is synthetic, and the UI says so** (notice bar, footer). Never put real company
  names, people or figures on screen, in the code or in comments.
* **Honest claims about learning.** Never present the recorded year's curve as learning: its first pass rates are an
  input to the generator, and a no-learning baseline of the same year climbs too. The learning claim is the with and
  without comparison from the learning year (`LearningChart`, `learningYear.ts`), always labelled "Simulated on the
  same engine". The recorded curve may still show what happened (the demo, the dashboard), with a 𝄐 where an answer
  became a rule, but no copy says it climbs because of them. Claims round toward the cautious side (the "times fewer"
  figure rounds down), and a figure the data does not hold is left out, not typed (the wrong store count is not in
  `learning.json`, so the site does not show it).
* **The website carries what the pitch carries.** A visitor who never sees the deck meets the same claims and figures
  on the site: the side by side comparison, what keeps a mistake small, the headline figures with dollars beside the
  rupiah. When a slide gains a claim or a figure, the landing page gets it too, read from the same data module.
* **Held is amber, everywhere.** Blocked is red, actions and data are blue, and everything else is neutral (Two colours
  with jobs, under Colour). Never reuse those colours for anything else.
* **Refusals are visible.** A denied transition or a refusal by the meeting manager is shown in red
  with the reason, never hidden.
* **Real, scripted or staged is always labelled** on every message in a case room. The dashboard's agent summary
  names only Claude or Code.
* **No chat box.** Case rooms look like a conversation, but people only answer question cards.
* **Accessible by default:** visible focus rings (`outline-accent`), `aria-current` on the active
  tab, radiogroups for switches, 44px touch targets on mobile, `role="status"` on loading.

## Adding a screen or component

1. Start from `PageHead` and `Card`; group related cards in a `.frame`.
2. Use the type classes and tokens above. If a value you need does not exist, add a token to
   `globals.css` and a line to this file, rather than writing a one-off value.
3. Numbers: `.num` in text, `Metric` or `.figure` for headline values, `Count` when they change live.
4. Check it at 375px wide and on desktop, and with reduced motion on.

## Ask the books (`src/app/ask`, `src/components/ask`)

A voice first, read only way to ask about the books. `/ask` shows it alone; `AskPanel` (`ask/panel.tsx`) mounts anywhere.

* **Not a chat.** One question and its answer at a time, at most three recent questions as small links, and four
  suggested questions at a time. No message list, no bubbles.
* **One flow, driven by the orb** (`ask/panel.tsx`): **invite** (a large orb, "Hold to ask", four suggestions in a two by two
  grid with More questions to step through the rest, the typed field) → **listening** (the orb follows the microphone) →
  **writing down the question** → **reading the books** → **speaking** (the orb shrinks beside the answer and the
  spoken sentence is the caption) → **done** (the answer's template under it, with Play and Ask again). A new question
  clears the old answer back to the large orb. The orb moves with a `motion` layout animation and is one element the
  whole way, so a press that starts on it always ends on it.
* **The orb is the push to talk control** (`ThinkingOrb`, `ask/orb.tsx`, behaviour from `usePushToTalk` in
  `ask/pushToTalk.tsx`): hold it (or focus it and hold Space or Enter), speak, let go. A small round badge on its lower
  edge says what it does: a blue mic, a blue stop square while listening, a grey crossed mic when there is no voice input.
  It is ported from **Speaking Orb** in Ship Notes components (github.com/aqualang89/shipnotes-components, MIT; the notice
  is in the file), not installed: a sphere of points drawn with WebGL (canvas fallback) whose shape blends between
  states. Our port draws for a cream page (solid points with normal blending; the nearest points deepen to `heading` navy
  instead of sparking white), reads its colours from the tokens, and drops the particle captions.
  * **Idle:** a slowly turning wave sphere in `heading-2` navy.
  * **Listening:** the same sphere in `accent`, its waves following the microphone level.
  * **Writing down the question:** three tilted rings, `accent` toward `info`.
  * **Reading the books:** a turning knot, halfway between `accent` and `info`.
  * **Speaking:** a soft lobed sphere in `accent` that swells with the answer's audio level, each syllable sending a ring up it.
  * Never amber (nothing is held) and never red. Levels come from `voiceLevel()` in `voice.ts`: an analyser on the
    microphone while recording, on the player while it speaks, or a syllable-like pulse when the browser has not
    started audio. Reduced motion draws one still frame per state and stops the loop; it also stops off screen.
* **The caption follows the voice** (`SpokenCaption`, `ask/caption.tsx`): the whole sentence is laid out faint from the start,
  so the line never reflows, and each word darkens as it is said (the current one in `accent`). Cartesia's mp3 has no word
  timings, so they are estimated from each word's spoken length (figures count longer) and stretched over the audio's real
  duration. The template rises in shortly after the caption starts. Screen readers get the question and the whole
  answer once, from an `aria-live` region; the word by word caption is hidden from them.
* **Labels stay on every answer:** "Recorded answer" or "Live: Claude chose the query", and "Every number checked against
  the data" or "Sentence written by code", as neutral pills beside Play and Ask again. Inside the templates, settled lines,
  a passed audit and "Written by Claude" are neutral too; held stays amber and a refusal red. The typed field is secondary, a quiet
  rounded field under the suggestions. Under it, once and quietly: "Read only: it can explain the books, never change them."
* **Five templates** (`ask/views.tsx`), each inside a `.frame` around a `.card`, each ending with its source:
  * **Figure**: one number in `.display` that `Roll`s in, a comparison beside it in `.figure`, an optional note.
  * **Trend**: twelve months as a line (shares) or bars (counts), with learned rules as accent pills. Never 𝄐.
  * **Breakdown**: rows of label, value and `Bar`; amber tone because what it breaks down is held.
  * **Lines**: a table of bank lines (date, memo, amount, outcome, rule, store) on wide screens, stacked rows on phones.
  * **Story**: a story or a rule: facts, the question and its answer (light amber box), the case room through `ChatList`
    in a `.scroll-quiet` panel, a rule's program as a `bg-night` code block, and the record (denied lines red).
* **The model never writes numbers or UI.** It picks a template and a named query (`convex/lib/ask.ts`); code runs the
  query and fills the template. It writes the spoken sentence after seeing the result, and code checks every number in
  that sentence against the result; if it fails twice, the template's own caption (written by code) is spoken instead.
  The answer says which: "Every number checked against the data" or "Sentence written by code". Answers are labelled
  "Recorded answer" or "Live: Claude chose the query".
* **Read only, enforced.** The assistant role in `ROLES` has no actions. Asking it to change something sends the request
  through the gateway, which refuses and records it; the answer shows the refusal as a red "Blocked by the gateway" note.
* **Presets first.** The suggested questions (`convex/lib/askPresets.ts`) and anything that matches them (plain keyword
  matching) are answered from `src/demo/ask.json` with the recorded audio in `public/ask/`, with no Claude call. Re-record
  with `npx tsx --env-file=.env scripts/export_ask.ts`. Only unmatched questions go live, rate limited per visitor and
  capped per day; past the cap the answer is "I can only answer the suggested questions right now".
* **One voice pipeline** (`listen` in `ask/voice.ts`) for the orb, the popup's shortcut and the case room's round button:
  the microphone recorder (Cartesia's transcript when the live service is there, and the orb's level) together with the
  browser's own speech recognition (`ask/speech.ts`: the words while the person speaks, and the transcript when there is
  no live service). Either is enough, so a spoken suggested question is answered from the recording on the hosted site too.
  Rising and falling earcons (`blipIn`, `blipOut`) mark press and release on the orb and the shortcut; the case room stays quiet.
* **Without a Convex URL** (the hosted site today) spoken and typed questions only match presets (anything else gets
  "I can only answer the suggested questions right now"), and recorded answers still play out loud and still drive the
  orb. Only where the browser can neither record for Cartesia nor recognise speech is the orb unpressable, with a crossed
  mic badge and a line saying why. A rate limit or a failed answer shows as a short note under the orb.
* **Screenshots in development:** `/ask?orb=listening` (or `transcribing`, `thinking`, `speaking`) holds the orb in that
  state; the check is compiled out of production builds. `/ask?q=<preset id>` opens a recorded answer without playing it.
* **Voice answers in a case room** (`voiceAnswer.tsx`): a question for the CFO can be answered by voice under its options,
  with the plain round `PushToTalk` button (64px or 48px, blue, `.listen` pulse while it listens).
  The answer is read back ("You said …. That means …") and only a spoken yes sends it, marked "By voice". Confirming the
  restated answer and approving a rule stay clicks.
* **Speech** is Cartesia: one voice, `sonic-3.6`, mp3. The browser gets a one minute access token from Convex, never the key.

## Ask the books, anywhere (`src/components/ask/overlay.tsx`)

On every site page (`/`, `/demo`, `/dashboard`, `/ask`; not the console, not the pitch, whose keys step the deck), hold
**Control + Option** (Ctrl + Alt on Windows, never Command) and ask out loud; let go to ask. Modelled on Loci's hold to talk.
`AskOverlay` is mounted once by `Providers` and keyed by page, so moving on closes it and stops its voice. It shares
everything with the panel: the question and answer (`useAsk`), the answer (`AnswerHead`, `AnswerBody` in `ask/answer.tsx`),
the orb (`OrbButton`) and the voice pipeline. Anything opens it with `openAsk()` (with `{ question }` it asks straight
away, with `{ type: true }` it opens on the type box).

* **Hold and release.** Keys down: a rising blip, the popup opens and says Listening at once (before the microphone has
  opened), the words appear as they are heard. Keys up: a falling blip and "Got it · writing down your question", then
  Reading the books, then the answer. Holding again while it speaks interrupts it. A tap under 280ms only opens the popup.
* **The shortcut is the call to action**, labelled per platform: "Hold ⌃ + ⌥ to talk" with a Control + Option tooltip on a
  Mac, "Hold Ctrl + Alt to talk" elsewhere (`useTalkKeys`, `TalkKeys`). On a phone or tablet (no fine pointer) it reads
  "Hold the orb to talk" and a small floating **Ask the books** button (white pill, blue mic, bottom right) opens the
  popup. The fallbacks are the orb itself, held by pointer or touch, and Space or Enter while it has focus.
* **The popup:** the orb on a canvas puck, then a card under it. Before an answer the card is the `.coach` card: "Hold
  ⌃ + ⌥ to talk", "Then say this aloud:" with one suggested question (the next one each time it opens), the status line
  with the live words, the read only promise and Esc, and a quiet Type instead (a type box prefilled with the
  suggestion). With an answer it is a white `.card` in a `.frame`: You asked, the captioned answer with its labels, the
  template, then **Ask next** (two suggested questions), the shortcut reminder and Type instead.
* **Calm, never in the way.** A soft `night` dim over the page on wider screens, a full canvas sheet on a phone (the
  header would crowd it). Escape, the close button or a click outside closes it. The shortcut is ignored while another
  text field has focus (the popup's own type box excepted), the popup is `data-lenis-prevent` so its own scrolling never
  moves the smooth-scrolled page, and it is a non-modal `dialog` that takes focus only when opened by a click.
* Two colours with jobs here too: blue for the orb's listening badge, links and the send button; amber only inside an
  answer that is about held lines; everything else ink, white and neutral. Reduced motion keeps the orb's still frames
  and the popup's fades.
