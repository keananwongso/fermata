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
| Headings | `heading` #0a2d66 · `heading-2` #0f3d7a · `night` #0b1d3a | Display and titles; footer |
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
* `.glass`: frosted white over whatever is behind it, a bright top rim, a soft warm shadow. **Voice only**: the Ask dock,
  its card, the panel's orb and the case room's voice answer. Nothing else is translucent. `.glass-chip` is a lighter
  glass well inside it (suggestions, Play and Stop); `.float` is the orb's slow bob while it works.
* `.hatch`: diagonal hatching on canvas for empty states and "nothing here yet".
* `.scroll-quiet`: put it on every scroll box inside a card. The scrollbar is thin and stays invisible until the box
  is hovered. Lists that stream in (the demo's engine) do not scroll at all: they clip with a fade at the bottom.
* `.field`: a text input or select. White, hairline border, radius 6px, blue border when focused, 44px tall on
  mobile and 36px on desktop. Its label is an `.eyebrow` above it.
* `.kbd`: a key or a shortcut in mono, white with a strong border.
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
  year closes. Ask the books is also on every page as the glass pill at the bottom centre (see Ask the books,
  anywhere), which adds no header link. `/ask` still works as a direct address; the footer lists every way in.
* The landing page follows one rhythm: a `Tag`, a `.display` or `.title` heading, one short paragraph, then a
  `LinkArrow`. Illustrations sit in a `.frame` around a `.card`.
* **The landing page scrolls with Lenis** (`SmoothScroll` in `motion.tsx`): eased scrolling with Hyphenate's feel,
  `lerp` 0.1 and a wheel multiplier of 1, so a notch carries the page as far as it would natively. Use `withLenis` to
  hook into it and `scrollToY` to move the page. The landing page hides its scrollbar while Lenis runs. Both are off
  under reduced motion, where the page scrolls natively. Do not add CSS scroll snap on top of it.
* **Every number on the site comes from the recording** (`src/demo/recording.json`, written by
  `scripts/export_demo.ts --preset learning`): the learning year as Fermata closed it, with the same year's frozen
  baseline beside it. Learning figures go through `src/components/learningYear.ts`. One file, so the demo, the
  dashboard, the landing page and the pitch tell the same year. Never type a figure into the page by hand.
* **The landing page has no Ask the books section** and no shortcut hint: the dock's pill is on screen the whole
  time and teaches itself.
* **The landing page's learning sections:** the banner states the learning claim (how many times fewer lines are left for
  people with learning, rounded down, then both year-end counts in one short line); **Proof** is a white card with a
  `Tag`, a `.title`, the first-pass climb as one figure on the right, and the `LearningChart` across the full width.
* **US dollars beside headline rupiah** (`usdApprox` in `src/components/money.ts`): one fixed, approximate rate of
  Rp 16,000 per dollar, rounded to two significant figures, in `faint` after the figure: "−Rp 48.6bn (about $3M)". Headline
  figures only, never table rows, and never inside the product window (the dashboard stays in rupiah, as the
  business would see it). Where Shopee and Tokopedia first appear on the page, say once what they are (Southeast
  Asia's Amazon and eBay).
* The demo does not call itself a recording on screen, but it never claims more than it is: every agent message
  inside a room keeps its Claude, code or scripted label, and answers the recording did not take are greyed out.
* **The demo ends in the closed books.** When the year closes, the case rooms card ends with the hand-off: the brand
  button **Explore the closed books** (`/dashboard`), **Ask the books** (opens the dock's card over the closed year), and Run it yourself as
  a quiet text link. Play again steps down to a secondary button so the hand-off is the one primary. The demo never
  embeds the dashboard; it sends the visitor there.
* **Hints only for a visitor who hesitates** (`useHints`, `Hint` in `demo/page.tsx`, drawn as `.tip`). Each waits for
  a pause with no click or key (any click or key restarts the wait): Close the year after 3.5s idle (the splash counts),
  the question card after 5s (under its scroll box, so it shows however far the options run), the hand-off after 3s at
  the close, and the engine stream after a mouse lingers 1.5s without clicking. One at a time, each at most once per
  visit, never over the agents' transcript, never taking a click, and gone the moment the visitor acts or the phase
  moves on. `?tips=off` turns them off for the visit, for recording. Hint copy never calls the demo canned,
  recorded, scripted or a replay.
* **How it works is a landing page section** (`#how`, right under the banner; the header's How it works link and the
  hero scroll to it, and `/how` redirects there). A `Tag`, one `.display` line, a link to the guided demo, then two
  parts with a `.title` each: **How it's built** (`HowDiagram`: eleven boxes on one canvas. **Whole flow** is the default:
  once the diagram is on screen it plays every path in turn from Day 0, the playing path's tab filling as it holds;
  pick a path, Day 0, Matches, Waits, Learns or Blocked, and only its boxes and lines light up, numbered, in the path's colour,
  with the steps in one numbered row under it; click a box and a small card opens beside it with two or three lines of
  what it is underneath (under the box on the top rows, over it on the bottom row). On a phone the steps
  list and box chips stand in for the canvas) and **Inside a case room** (`HowRoom`: story B's real meeting, played on its own while on screen: a message at a
  time with the transcript following it at full width, then the question's column opening from the right and pushing it over, the recorded answer picked, the rest of the room, a
  pause, then again. Nobody has to touch it; it still scrolls by hand, with `data-lenis-prevent` so the page's smooth
  scroller leaves the wheel alone) and **How it learns** (`HowLearns`: two worked examples, one from last
  year's books (r4) and one from an answer (r9), each four numbered cards: the bank line, what it pays for, the number
  it learned and where from, the rule).
* **The landing page says each thing once:** hero and product window, the banner (the year-end counts), How it works,
  Proof (the curve and the first-pass climb only), Ask the books, then one closing with the call to action.
* **The demo is one fixed screen** on wide screens (1280px and up): no heading, no footer, no page scroll. The controls
  and the months share the top row, the stats sit under them, and the workspace takes whatever height is left, each panel
  scrolling inside itself. The page marks itself `data-fixed-page`; `globals.css` hides the footer and the page scroll
  from that. Below 1280px the panels stack and the page scrolls as usual (still no footer).
* **The demo has one stop.** The year plays on its own; every room closes by itself except story B (a lender nobody
  knew), where the agents meet, an approval is refused in code, and the visitor answers the CFO's one question. That
  room is the demo's only `LIVE` room. Explaining is How it works' job on the landing page, not the demo's.
* **Plain words on the site.** Say payments, not lines; waiting, not held; no "X: y, z" formula captions. Each caption is
  a sentence a shop owner would say.
* **Copy is skimmable.** A title, caption or hint is one short phrase, readable at a glance. No paragraphs inside the
  demo or a stop; when something needs more words, it needs a picture instead.
* Grid children that hold truncating text need `min-w-0`, or they push the page wider than the phone.

## Dashboard (`src/components/dashboard.tsx`, `/dashboard`)

The product as an app window: the landing page's hero and the calm overview page at `/dashboard`. It reads only the
recording, so it works on the hosted site with no Convex, and a re-export updates every figure.

* **`/dashboard` is one fixed screen** on wide screens (1280px and up), like the demo: no heading, no footer, no page
  scroll. The window fills what the header leaves (`Dashboard fill`, `data-fixed-page`) and every view, the overview
  included, scrolls inside it. Below 1280px the page scrolls as usual. On the landing page the window keeps its own height.

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
  own") states the year as it happened; the learning claim, with its simulated baseline, lives in the comparison (see
  Honest claims about learning).
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
  opens a room's transcript (`ChatList`) beside its question and recorded answer; Rules opens on a collapsible Day 0
  panel (open by default: for each onboarding rule, the question asked of last year's books, the fit, how many lines it
  saw, approved once by the CFO) and then shows each rule's source, backtest, audit and code; Run, Evaluation and Record are one card each (what the screen is, a real preview where the
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
  always, saying what each line is: `CLOSE_CAPTION` for the learning year as Fermata closed it against its simulated
  frozen baseline (landing page, pitch), `SIM_CAPTION` when both lines are simulated (What if).
* Three widths keep its labels near 11px: a phone chart below `sm` (single letter months), a mid one, and a wide one
  from `lg`. `stage` draws only the mid one, for the pitch, which scales it with CSS `zoom`.
* **Two notes make the flat stretch read as the point, not a stall.** Both are worked out from the data, never typed:
  * **The gap is shaded** `accent` at 7% and labelled "What learning did", where it is widest in the second half.
  * **"Something new arrives: both dip, only learning recovers"** sits under the first month in which the baseline
    drops more than a point and a half and learning recovers the next month.

  On phones only the shading and its label show. Why first pass tops out near 95% (records that arrive after their
  bank line) is a Q&A answer, not a chart note.
* Both lines draw in left to right behind a growing clip the first time it scrolls into view (not `pathLength`, which
  would overwrite the baseline's dashes).
* Feed it `{ months, learned }` per run: a run from `/api/simulate`, or the recording through
  `src/components/learningYear.ts`.
* **The demo's own curve** (`/demo`) draws the year's first pass as it closes, with the baseline dashed beside it as
  far as the year has run, a legend naming it "Without learning, simulated", and a 𝄐 over each month whose answer became
  a rule.

## System diagram (`src/components/systemDiagram.tsx`)

`SystemDiagram` is how Fermata is built, drawn as an architecture diagram: the pitch's How it's built slide, and ready for
the landing page. It takes `step` (how many flows show, 0 to 3), `size` (`stage`: a fixed 1680×700 canvas in stage px;
`fit`: the same canvas scaled to its container's width), `focus` and `legend`.

* **One hub, everything through it.** The system of work (Convex, `transition()`) is the one `heading` navy tile in the
  centre. Every line enters or leaves it; nothing talks to the books any other way.
* **Zones** are `warm` trays with a 1.5px `strong` border and radius 16px, each with a small white badge (a line icon) flush
  in its top-left corner, an eyebrow name beside it and a `faint` note on the right: Sources (left), Case room (top),
  Engine (below the hub), People (lower left), Books (right). Claude and Ask the books are single tiles outside the zones.
* **Tiles** are white cards (radius 10px, hairline) with a simple line icon on `well`, or the `Avatar` for a role. Avatars
  are plain (`PlainAvatars`): colour belongs to the lines. Under each role's name is what it may do, read from `ROLES`
  in code, never typed (this replaced the slide's old roles table).
* **Three flows, one colour each, routed at right angles with rounded corners and arrowheads.** Parallel lines in a bundle
  sit 24px apart and are labelled in their colour beside the bundle, with ↑ or ↓ for direction:
  * **Accent: settles on its own.** Sources sync into the hub, the engine matches and settles it, the gateway posts it.
  * **Hold: needs a person.** The engine holds a story, the case room meets, one question goes to the Accountant or CFO,
    the answer comes back, and the rule returns to the engine.
  * **Danger, dashed: refused, and recorded.** An agent tries to approve; the gateway refuses (a red ✕ on its edge) and the
    refusal goes to the audit log.
  * Quiet connections (Claude to the three agents, Ask the books reading from the hub) are thin `mute` lines.
* **Motion.** A flow's lines draw in along its route (a mask over each line, so dashes survive), then a packet (a 12px
  dot with a soft halo) travels the whole route on a loop at a calm, even speed, pausing inside each tile; the four sources'
  packets leave so they merge on the bus. Only the newest flow moves: earlier flows recede (lines to 55%, labels to 75%) so it reads on its own while they stay legible
  (`focus`). Under reduced motion the lines are still and there are no packets.
* **The legend** sits top right: the three flows in plain words, the upcoming ones at 35%, and one `faint` line saying
  where the roles come from.

## Learning diagram (`src/components/learningDiagram.tsx`)

`LearningDiagram` is how Fermata learns: the pitch's How it learns slide, on a fixed 1680×720 canvas in stage px. Three
layers bottom to top in `warm` trays (Precedents, Policies, Rules), labelled at the left; the bank lines stream along the
bottom at all times; the CFO sits right of the rules, the three agents beside the policies, the Accountant right of the
precedents. The bottom-right corner is an empty dashed frame labelled Live demo, kept for the recorded demo in the edit.

* `step` builds it up and never resets: Day 0 (grey dots cluster, each cluster's fit settles in `accent`, rises into a
  policy card with its evidence count, then a rule tile the CFO stamps), the year runs (rules reach down to the stream,
  most lines settle blue, the rest gather into amber stories with their gap), a story becomes a rule (a case room with
  one red refusal, one question to the CFO, the rule's backtest), a no and a fall, then the `measured` slot over the
  dimmed diagram.
* Rule tiles show a limit without its amount (no rupiah on this slide) and a badge: `fitted` for Day 0 rules, which the
  recording holds no backtest for, and covered and wrong for a learned rule.
* What Day 0 asked and fitted is `src/components/dayZero.ts`, shared with the dashboard's Rules view. Evidence counts are
  each rule's `seen` (from the recording once re-exported, until then a table read from the rules on Convex).
* Anything shown that the recorded year did not do (a rule falling) says so in one `faint` line under the stream; the
  room's messages are paraphrased and say so too.

## Pitch deck (`src/app/pitch`, `src/components/pitch`)

`/pitch` is the deck for the Devpost video and any live pitch. It is a page of the app, not a slide file, so it
uses the same tokens, type classes, components and motion as the screens it introduces.

* **A fixed 1920×1080 stage**, scaled to fit the window and letterboxed on `inset`. Write slide sizes in px for
  that canvas (no `clamp` or `vw`). It covers the header and footer while open.
* **Keys:** → / space step through a slide's builds, then the slides; ← goes back; `N` shows the spoken script;
  `F` full screen; `H` hides the slide counter for recording. `#n` in the URL opens slide n.
* **One idea per slide.** A slide is a `Frame` (chapter eyebrow top left, the mark and page number below), a
  `.title` heading in sentence case, then one visual. Chapters use the judges' words (Why, How it works,
  How it learns, Case rooms, How it's built, Self improving, Proves every step, The result).
* **Five beats, about three minutes.** 1 My family's business (`mess`: the channels, shared accounts and the books'
  balances; then the systems that disagree; then the head office balance as one piece of evidence, struck through).
  2 Not just us (`everyone`: the same tiles, named for any retailer, the store grid grows). 3 The title. 4 How it
  works, How it learns, Case rooms, How it's built, Self improving, Proof, then Stack and How we measure (optional,
  skipped in the video). 5 The close (`scale`: stores multiply while the policies and rules row and the decisions
  for people stay put, then the two closing lines) and the end card. Spoken notes for beats 1, 2, 3 and 5 are the
  approved script, word for word.
* **Grown grids are a shape, not a measurement.** Where stores multiply (beats 2 and 5) no count is printed on the
  larger grid, and the close says the recorded year has the stores `D` has.
* **Day 0 rules are fitted, not backtested.** They are fitted on last year's rows and approved once; only learned
  rules carry a backtest. No slide or note says otherwise.
* **Every figure comes from the recording or the learning year** through `pitch/data.ts` (`D.learning` is
  `learningYear.ts`); assumptions (minutes per match, per decision) are printed on the slide that uses them. Something
  not yet measured shows a `.hatch` placeholder, never a typed number. Spoken notes that quote a figure interpolate it
  from `D` too.
* **Self improving** is the `LearningChart` (stage size, `zoom`) under the first pass and the lines left for people,
  with and without learning: the learning year as closed, against its simulated baseline.
* **How it's built** is the `SystemDiagram` at stage size under a one line title, with three builds: settles on its own,
  needs a person, refused.
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
| `.flow` | Money flowing along a line: dashes travel toward its end (the how-it-works card's first beat) |
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
* Header: a floating
  white header card with the 𝄐 Fermata wordmark, the tabs (`nav.ts`), and the Acting as switch
  (Accountant / CFO). On the site pages the card hugs its contents and sits centred (wordmark, two links, the GitHub
  icon, the demo button, with modest gaps), never stretched to the page; the console's card keeps the page width
  (60px narrower) for its six tabs and the switch. On mobile both are full width and the links fold into a menu.
  The card sticks to the top, so the header never moves when you scroll or jump to an anchor; give anchor targets
  `scroll-mt-36` so they land below it. Only the card takes the pointer (its full-width wrapper is
  `pointer-events-none`), so controls that scroll beside it, like the demo's Pause, stay clickable. No notice bar and
  no "fictional" on screen; the closing's "Modelled on a multi-store retailer" is the one hint.
* Footer: navy, a large faint 𝄐, the tagline, the screens, and the music mark line.
* Tabs live in `src/components/nav.ts`; add a screen there once and the header and footer pick it up.

## Rules that carry the product

* **Every number is synthetic.** The site says so quietly ("Modelled on a multi-store retailer"), never with "fictional". Never put real company
  names, people or figures on screen, in the code or in comments.
* **Honest claims about learning.** The recording is the learning year: nothing in its generator plants a first pass
  rate, so its curve climbs only where an answer became a rule, and the same year with the rules frozen (the baseline,
  simulated on the same engine) stays flat. The claim is always that with and without comparison, and the baseline is
  always labelled simulated. Say how the answers came (autopilot reads the generator's answer key) and who wrote each
  rule (Claude in a live room, or code) wherever it matters. Claims round toward the cautious side (the "times fewer"
  figure rounds down), and a figure the data does not hold is left out, not typed.
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

* **Not a chat.** One question and its answer at a time and a few suggested questions. No message list, no bubbles.
* **One flow, driven by the orb** (`ask/panel.tsx`), in the dock's glass and with no surface of its own (the page gives
  it one: the dashboard window, or a `.card` on `/ask`): **invite** (the large glass orb, "Hold to ask" and one short
  line under it) → **listening** (level bars and the words as they are heard) → **Got it** → **Reading the books** →
  **speaking** (the orb shrinks beside "You asked" and the question; the spoken sentence is the caption, then Play again
  or Stop, Ask again and one faint provenance line, then the template). Under both: the suggestions as `.glass-chip`
  pills (four, with a small refresh icon to step through the rest; "Ask next" and three once there is an answer) and
  one `.glass` bar to type in. The orb moves with a `motion` layout animation and is one element the whole way, so a
  press that starts on it always ends on it.
* **The orb is the push to talk control** (`ThinkingOrb`, `ask/orb.tsx`, behaviour from `usePushToTalk` in
  `ask/pushToTalk.tsx`): hold it (or focus it and hold Space or Enter), speak, let go. It sits in a `.glass` circle with
  no badge: the words beside it say what it does.
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
* **Labels stay on every answer**, as one faint line beside Play: Recorded or Live (Claude chose the query), and every
  number from the books or written by code. Inside the templates, settled lines, a passed audit and "Written by Claude"
  are neutral; held stays amber and a refusal red. Read only is said once, in the view's line ("Read only, and every
  number comes from the books").
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
* **One voice pipeline** (`listen` in `ask/voice.ts`) for the orb, the dock and the case room's voice answer:
  the microphone recorder (Cartesia's transcript when the live service is there, and the orb's level) together with the
  browser's own speech recognition (`ask/speech.ts`: the words while the person speaks, and the transcript when there is
  no live service). Either is enough, so a spoken suggested question is answered from the recording on the hosted site too.
  Rising and falling earcons (`blipIn`, `blipOut`) mark press and release on the orb and the dock; the case room stays quiet.
* **Without a Convex URL** (the hosted site today) spoken and typed questions only match presets (anything else gets
  "I can only answer the suggested questions right now"), and recorded answers still play out loud and still drive the
  orb. Only where the browser can neither record for Cartesia nor recognise speech is the orb unpressable, with a crossed
  mic badge and a line saying why. A rate limit or a failed answer shows as a short note under the orb.
* **Screenshots in development:** `/ask?orb=listening` (or `transcribing`, `thinking`, `speaking`) holds the orb in that
  state; the check is compiled out of production builds. `/ask?q=<preset id>` opens a recorded answer without playing it.
* **Voice answers in a case room** (`voiceAnswer.tsx`): under a CFO question's options, one `.glass` strip with the
  `PushToTalk` pill ("Hold to answer"; it fills blue with `LevelBars` while it listens) and one line beside it: the
  words as they are heard, or "Or answer out loud. It's read back first." A matched answer swaps the strip for "You said"
  and the option and its impact, read back out loud, then **Send answer** (primary), the pill again as "Or say yes", and
  Cancel. It is sent marked "By voice". Confirming the restated answer and approving a rule stay clicks on the card.
* **Speech** is Cartesia: one voice, `sonic-3.6`, mp3. The browser gets a one minute access token from Convex, never the key.

## Ask the books, anywhere (`src/components/ask/overlay.tsx`)

One `.glass` pill at the bottom centre of every page, console and pitch included: a small idle orb, "Ask the books", and
the shortcut in faint mono (⌃⌥ on a Mac, Ctrl Alt elsewhere; keyboards only). `AskOverlay` is mounted once by
`Providers` and keyed by page, so moving on closes it and stops its voice. It shares the question and answer (`useAsk`),
the answer (`AnswerBody`, `SpokenCaption`), the orb and the voice pipeline with the panel. Anything opens it with
`openAsk()` (with `{ question }` it asks straight away). A page with its own `AskPanel` hides the resting pill
(`useHideDock()`); the shortcut still works there.

* **Hold to talk, tap to look.** A press held past 180ms listens (a rising blip); letting go asks (a falling blip). A
  shorter press is a tap: it opens the card with suggested questions, closes it if open, or stops the voice while it
  talks. The microphone opens only on a hold, so a tap never asks for permission. Control + Option (Ctrl + Alt, never
  Command) does the same anywhere except in a text field; Space or Enter does it while the pill has focus.
* **The pill becomes the orb.** While it listens, writes down the question, reads the books or speaks, the pill morphs
  (a spring layout animation) into a 76px glass circle with the orb filling it and bobbing gently (`.float`). With the
  card closed, a glass bubble above it carries `LevelBars` and the words as they are heard, then Got it, Reading the
  books, Answering. Back at rest it is the pill again.
* **The card rises out of the pill**: `.glass`, radius 26px, up to 600px wide and never taller than `min(72vh, 680px)`,
  scrolling inside (`.scroll-quiet`, `data-lenis-prevent`). Its head is "Ask the books" and what the orb is doing, with
  the close button. With an answer: the question in quotes, the spoken sentence as a `SpokenCaption`, Play again or Stop
  (a `.glass-chip`) with one faint provenance line (Recorded or Live · every number from the books or written by code),
  the template, and **Ask next** (two suggestions as glass chips). Without one: one line ("Hold the button below and ask
  anything about the books.") and **Or try** (four suggestions).
* **Calm, never in the way.** A faint `night` veil at 10% with no blur while the card is open; a click on it, Escape or
  the close button closes. The dock sits 16px from the bottom edge (or the safe area).
* Two colours with jobs here too: blue for the orb, the level bars and links; amber only inside an answer about held
  lines; everything else ink and white glass. Reduced motion keeps the orb's still frames and the fades.
