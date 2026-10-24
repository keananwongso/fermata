# Fermata design system

Read this before building or changing any screen. It describes the UI as it is built in
`src/app/globals.css` and `src/components/`. When the code and this file disagree, fix one of them
in the same change.

## Character

Calm, exact, warm. Fermata is a finance tool that holds only where it should, so the interface is
quiet by default and loud only where something needs a person:

* **Cream, not white.** Pages sit on a warm cream canvas; cards are white on top of it.
* **Navy for what you read, blue for what you do, amber for what waits.** No other colours carry meaning.
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
| Success | `success` #2e9e5b · `success-tint` | Settled, passed |
| Danger | `danger` #d23b30 · `danger-tint` | Blocked, denied, wrong |
| Info | `info` #00a3a0 · `info-tint` | Approved but not yet posted |

Shadows are warm (`rgb(85 40 20 / …)`), never grey-black.

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
* **Working** agents show a breathing amber dot and "working", and their queries appear as they run.
* The room header shows the turn count ("Turn n of 6") and the room state: In meeting (accent, breathing),
  Asked (hold, 𝄐), Closed (success).

## Motion (`globals.css`, `src/components/motion.tsx`)

| Name | Use |
| :--- | :--- |
| `.calm` | Default transition for colour, border, shadow, opacity, transform: 300ms `--ease-brand` |
| `.enter` | Content appearing on load: 400ms rise from 12px |
| `.arrive` | A live row that arrived after first paint: slides in with a brief blue tint |
| `.breathe` / `.breathe-dot` | Something is waiting on a person (amber pulse) |
| `.draw` | Lines and charts drawing in |
| `.rise` | Fade in, used by `BrandGrid` cells |
| `Count` / `useTween` | Live Convex numbers count toward their new value instead of jumping |
| `useLive` | Only rows that arrive after first paint animate |
| `BrandGrid` | Stepped blue cells at the edges of a hero, clearing toward a readable centre |

Easings: `--ease-brand` for most things, `--ease-out` for entrances, `--ease-spring` only for small
toggles (the menu icon), `--ease-exit` for leaving. Everything is disabled under
`prefers-reduced-motion`; new animations must respect it too.

## Layout

* Content width 1240px (`max-w-[1240px]`), gutters `px-4` mobile and `lg:px-10` desktop.
* The desktop/mobile switch is `lg` = 1025px and up. Design mobile first; no horizontal page scroll.
* Header: a navy notice bar ("every store, amount and person here is synthetic"), then a floating
  white header card with the 𝄐 Fermata wordmark, the tabs (`nav.ts`), and the Acting as switch
  (Accountant / CFO). On mobile the tabs fold into a menu.
* Footer: navy, a large faint 𝄐, the tagline, the screens, and the synthetic-data line.
* Tabs live in `src/components/nav.ts`; add a screen there once and the header and footer pick it up.

## Rules that carry the product

* **Every number is synthetic, and the UI says so** (notice bar, footer). Never put real company
  names, people or figures on screen, in the code or in comments.
* **Held is amber, everywhere.** Settled is green, blocked is red, actions are blue. Never reuse
  those colours for anything else.
* **Refusals are visible.** A denied transition or a refusal by the meeting manager is shown in red
  with the reason, never hidden.
* **Real, scripted or staged is always labelled** on agent output.
* **No chat box.** Case rooms look like a conversation, but people only answer question cards.
* **Accessible by default:** visible focus rings (`outline-accent`), `aria-current` on the active
  tab, radiogroups for switches, 44px touch targets on mobile, `role="status"` on loading.

## Adding a screen or component

1. Start from `PageHead` and `Card`; group related cards in a `.frame`.
2. Use the type classes and tokens above. If a value you need does not exist, add a token to
   `globals.css` and a line to this file, rather than writing a one-off value.
3. Numbers: `.num` in text, `Metric` or `.figure` for headline values, `Count` when they change live.
4. Check it at 375px wide and on desktop, and with reduced motion on.
