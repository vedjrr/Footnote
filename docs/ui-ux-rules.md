# Footnote: UI and UX rules

Read this before any task that touches what a person sees. Load the
`frontend-design` skill as well, and the `dataviz` skill for anything with a
chart. Where a skill and this file disagree, this file wins, because it holds
the decisions already made for this product.

The interface matters as much as the engine. A correct answer in a generic
shell reads as a demo. Budget real time for it in every UI task.

## 1. The idea

Footnote looks like an analyst's annotated working papers, not like a chat app
and not like a dashboard.

The product's one promise is that every number can be checked. The design makes
that promise visible: the briefing is a document you read, and each number
carries a small numbered reference mark. Selecting a mark runs a highlighter
over the number and opens its working paper in the margin, on ledger-green
paper, with the matching cell highlighted there too. Claim on the left,
evidence on the right, joined by the same yellow.

That linked highlight is the one memorable thing. Everything else stays quiet
so it can be.

Where the look comes from: accountants' columnar pads (pale green paper), blue
pencil reference marks, a yellow highlighter, and the typefaces IBM drew for
business documents. These are choices from the subject, which is why the
result will not look like another product.

## 2. Colour

Define every colour once as a CSS variable in `src/ui/tokens.css`. Components
use the variables, never raw hex. Contrast figures below were computed for
these exact values; if you change a value, recompute and update the table.

### Light

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `--paper` | `#FFFFFF` | page, reading column, chart surface | |
| `--ledger` | `#EEF5EF` | working paper, evidence areas, the notice row | |
| `--wash` | `#F5F7FA` | table header rows, input backgrounds, hover | |
| `--ink` | `#15202F` | text, primary buttons | 16.4 on paper |
| `--ink-2` | `#46526A` | secondary text | 7.9 on paper |
| `--ink-3` | `#5F6A7F` | captions, axis labels, placeholders | 5.4 on paper, 4.9 on ledger |
| `--rule` | `#D9DEE5` | hairlines on paper | |
| `--ledger-rule` | `#C7D9CC` | hairlines on ledger | |
| `--mark` | `#1F4FD1` | reference marks, links, focus ring | 6.8 on paper, 6.1 on ledger |
| `--highlight` | `#FFE45C` | the linked highlight, nothing else | ink on it: 12.9 |
| `--good` | `#0B6E2A` | status text, with icon and label | 6.4 |
| `--caution` | `#8A5A00` | status text, with icon and label | 5.9 |
| `--critical` | `#B42318` | status text, with icon and label | 6.6 |

### Dark

Chosen for the dark surface, not inverted from light.

| Token | Hex | Contrast |
|---|---|---|
| `--paper` | `#101823` | |
| `--ledger` | `#12231B` | |
| `--wash` | `#17212F` | |
| `--ink` | `#E8ECF2` | 15.1 on paper |
| `--ink-2` | `#B6C0CF` | 9.7 |
| `--ink-3` | `#8A97AB` | 6.0 |
| `--rule` | `#283446` | |
| `--ledger-rule` | `#27473A` | |
| `--mark` | `#8FB0FF` | 8.4 |
| `--highlight` | `#5E4A00` with text `#FFF3BF` | 7.7 |
| `--good` / `--caution` / `--critical` | `#4CC38A` / `#F2C14E` / `#FF8A80` | 8.1 / 10.6 / 7.8 |

Theme follows the system setting, with a toggle that overrides it and is
remembered. Dark values are declared under both
`@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`.

Rules:

- Yellow means "this is the number you selected and here is its evidence". It
  is never used for decoration, warnings or emphasis.
- Blue means "you can select this". It is not used for large fills.
- Green tint means "this is evidence". It is not a general card background.
- Rise and fall are never shown by colour alone. Use the sign and a word.
- No gradients, no translucency, no blur, no glow.

## 3. Type

Three faces from one family, loaded with `next/font` so nothing is fetched from
a third party at run time.

| Face | Role |
|---|---|
| IBM Plex Serif, 400 and 500 | the briefing and answers: headlines and sentences Footnote wrote |
| IBM Plex Sans, 400, 500, 600 | everything you operate: navigation, controls, tables, charts, working papers, standalone figures |
| IBM Plex Mono, 400 | SQL only |

The split carries meaning: serif is what Footnote says, sans is the machinery.
Do not use mono for labels or small data text.

| Token | Size / line height | Face | Use |
|---|---|---|---|
| `headline` | `clamp(30px, 2.2vw + 16px, 44px)` / 1.18 | Serif 400 | the lead finding. Max width 30ch |
| `h2` | 24 / 32 | Serif 500 | section headings |
| `lead` | 21 / 32 | Serif 400 | first sentence of a finding |
| `prose` | 18 / 30 (17 / 28 on phones) | Serif 400 | briefing and answer text. Max width 66ch |
| `figure` | 28 / 32 | Sans 600 | standalone key figures. Proportional digits |
| `body` | 16 / 24 | Sans 400 | interface text |
| `small` | 14 / 20 | Sans 400 or 500 | controls, tables, working paper |
| `caption` | 12 / 16 | Sans 400 | axis labels, table notes |
| `mark` | 11 / 1, raised | Sans 600 | reference marks |
| `code` | 13 / 20 | Mono 400 | SQL |

- Tabular digits (`font-variant-numeric: tabular-nums`) in table columns and
  axis ticks only.
- Sentence case everywhere. No all-capitals labels. No letter-spaced labels.
- No small label sitting above a heading to introduce it.
- Do not style one word of a headline differently from the rest.
- Left aligned. Nothing is centred except the content of an empty state.

## 4. Space, shape, depth

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96. Use only these.
- Vertical rhythm in the briefing: 48 between findings, 16 between a sentence
  and its chart, 96 before "Before you rely on this".
- Radius: 2 px on inputs, buttons, tags and table corners; 6 px on the Ask bar,
  menus and sheets; 0 on the working paper column and on charts. Never fully
  rounded pills.
- Depth: one shadow, for things that float above the page (menus, the phone
  sheet): `0 8px 24px rgb(21 32 47 / 0.12)`. Nothing else has a shadow.
- Findings are sections of a document separated by space and, where a section
  starts, a 32 px wide rule. They are not cards. No grid of boxes.
- Icons: one outline set (Lucide), 1.5 px stroke, 16 or 20 px, used only where
  they carry meaning: check, caution, close, chevron, copy, download, plus,
  search, sun, moon. No decorative icons. No emoji.

## 5. Layout

### Desktop, 1200 px and wider

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Footnote¹   Harbour & Pine (sample) ▾     Briefing Ask Metrics Data health │
│                                           Report        Accuracy  AI assist│
├──────────────────────────────────────────────────┬─────────────────────────┤
│                                                  │ ledger green, sticky    │
│   Revenue fell 7.4%¹ in March, from 1.31M        │                         │
│   to 1.21M². Three quarters³ of the fall         │ 1  Revenue, March 2025  │
│   came from Electronics sold online in           │    against February     │
│   the West.                                      │                         │
│                                                  │    Revenue is the sum   │
│   [ line chart, March marked ]                   │    of revenue.          │
│                                                  │                         │
│   ──                                             │    Feb 2025   1,307,412 │
│   What else changed                              │    Mar 2025   1,210,655 │
│                                                  │    Change       −7.4%   │
│   The top 20% of customers hold 61%⁴ of          │                         │
│   revenue ...                                    │    ✓ Parts add up       │
│                                                  │    ✓ 4,212 rows         │
│   ──                                             │    ✓ Period is complete │
│   Before you rely on this                        │                         │
│                                                  │    Rows behind it  ▸    │
│   1.2% of rows are exact duplicates⁵ ...         │    SQL             ▸    │
│                                                  │    Copy SQL  Add to     │
│   ┌──────────────────────────────────────────┐   │    report               │
│   │ Ask about this data                      │   │                         │
│   └──────────────────────────────────────────┘   │                         │
└──────────────────────────────────────────────────┴─────────────────────────┘
```

- Left padding of the reading column: `clamp(24px, 8vw, 128px)`. Reading column
  max 680 px. Gap 64 px. Working paper column 400 px, full height below the top
  bar, flush to the right edge, ledger background.
- With no mark selected, the working paper shows the data at a glance: rows,
  date range, the period being reported, and the data health summary.
- The Ask bar stays at the bottom of the reading column while you scroll.

### Tablet, 768 to 1199 px

Reading column with 32 px side padding. The working paper slides in from the
right over the page, 400 px wide, when a mark is selected, and has a close
button. Focus moves into it and returns to the mark on close.

### Phone, under 768 px

Single column, 16 px side padding. Navigation collapses into a menu. The
working paper is a sheet from the bottom, up to 80% of the height, with a close
button. The Ask bar sits at the end of the briefing and behind an "Ask" item
in the top bar.

No horizontal scrolling of the page at any width. Wide tables scroll inside
their own container with the first column fixed.

## 6. Components

### Top bar

56 px tall, `--paper` with a `--rule` line below. The wordmark is the product
name in Plex Serif 500 at 18 px followed by a raised 1 in `--mark`. That is
the only brand flourish. Then the workspace switcher, the navigation as plain
text links with the current one underlined in `--ink`, and on the right the
Accuracy link, the AI assist control and the theme toggle.

### Reference mark and highlight

- A raised number in `--mark`, numbered in reading order from 1 on each page.
- It is a real `button` with an accessible name such as "Note 3: how 7.4% was
  computed". The clickable area is at least 24 by 24 px even though the glyph
  is small.
- The number it belongs to is wrapped with it, so selecting the number works
  too.
- Hover or focus: a 1 px `--mark` underline appears under the number.
- Selected: the number gets the `--highlight` background, the working paper
  shows that note, and the cell or cells holding that value in the working
  paper get the same highlight. `aria-expanded` and `aria-controls` are set.
- A number whose checks include a caution shows a small caution icon beside the
  mark, with a text equivalent.

### Working paper

Order of content, top to bottom:

1. The note number and a plain title: metric, period, comparison.
2. The definition in words: "Revenue is the sum of revenue."
3. Scope: period and filters, as text.
4. The result as a small table, up to 8 rows, with "Show all" beyond that.
5. Checks, each with an icon and a sentence.
6. "Rows behind it": collapsed; opens five sample rows and the count.
7. "SQL": collapsed; mono, wraps, no horizontal scroll under 400 px.
8. Actions: "Copy SQL" (label becomes "Copied" for 1.5 s), "Add to report"
   (becomes "Added to report").

### Finding

- Headline finding: `headline` type, then a chart, then one or two `prose`
  sentences on where the change came from.
- Other findings: a `lead` sentence, optional `prose`, optional small chart,
  and up to three suggested questions as plain text links.
- A finding has no border, background or icon.

### Ask bar and composer

- One input, 6 px radius, 56 px tall, with a visible label ("Ask about this
  data"). The placeholder is one real example built from this workspace's
  dictionary, such as "revenue by region, last 3 months". It does not rotate
  or animate.
- As you type, a menu offers matching metrics, dimensions, values and periods,
  each with its kind written in words on the right. Arrow keys and Enter work.
- `/` focuses the bar from anywhere. `Esc` closes the menu.

### Interpretation row

Below each question, the parts Footnote understood, each as a small tag with a
label and value: "Metric Revenue", "Split by Region", "Period Jan to Mar 2025",
"Compared with Previous period". Tags have a hairline border, 2 px radius and
`small` type. Each is a button that opens a menu to change that part. A part
Footnote assumed (not stated in the question) is marked "assumed".

### Answer

Question as an `h2`, the interpretation row, the answer sentence in `prose`
with marks, the chart, a "Table" toggle, suggested follow-ups, "Add to report".
Questions and answers stack as a document. No bubbles, no avatars, no "typing"
dots.

### Progress

One line of `small` text that names the real step and updates: "Reading 48,210
rows", "Working out what the columns mean", "Comparing March with February".
No spinner on its own, no shimmer. When recomputing something already on
screen, keep the old content at 60% opacity until the new content replaces it.

### Buttons and fields

- Primary: `--ink` fill, `--paper` text. One per view at most.
- Secondary: 1 px `--ink` border, transparent.
- Quiet: text in `--mark`, underline on hover.
- Do not add arrows or other glyphs to button or link text.
- Every field has a visible label. Errors appear below the field as a
  sentence, with the caution icon.
- Focus ring: 2 px `--mark`, 2 px offset, on everything focusable.

### AI assist control

In the top bar: "AI assist" with its state in words (On, Off, Unavailable).
Opens a panel that states exactly what is sent and to whom (FR-45), with the
switch and, in Settings, a field for the user's own key. No sparkle icons, no
purple, no "magic".

## 7. Charts

Follow the `dataviz` skill's procedure: choose the form first, colour last.

- **Forms in use**: line (trend), column or bar (compare), ranked horizontal
  bar (top N), waterfall (where a change came from), small multiples (one
  measure across a few segments), sparkline, and a table view for every chart.
  Nothing else without a note in `decisions.md`.
- **Never**: two y-axes, pie or donut, 3D, stacked area with more than three
  series, a chart for one or two numbers (show the figures instead).
- **Emphasis first.** Most charts here make one point. Draw the series or bar
  that the sentence is about in series blue and the rest in context grey.
- **Marks**: lines 2 px with round joins; bars at most 24 px thick with a 4 px
  rounded data end and a square baseline; a 2 px gap in the surface colour
  between touching marks; end dots 8 px with a 2 px surface ring.
- **Axes and grid**: solid 1 px lines in `--rule`, never dashed. Y ticks at
  round values. Axis text in `--ink-3`, `caption` size, tabular digits.
- **Labels**: label the point the sentence is about and the line ends. Not
  every point. Text is always an ink token, never the series colour. A label
  that does not fit moves outside the mark or is dropped; it is never clipped.
- **Legend** whenever there are two or more series. None for one.
- **Hover and focus**: lines get a vertical guide that snaps to the nearest
  period and one tooltip listing every series; bars are their own targets, at
  least 24 px. Keyboard focus shows the same as hover. Every value in a tooltip
  is also in the table view.
- **Category and value names come from files.** Insert them as text nodes.

Colours, validated with the skill's script on these surfaces (light on
`#FFFFFF`, dark on `#101823`):

| Role | Light | Dark |
|---|---|---|
| Series 1 (and emphasis) | `#2a78d6` | `#3987e5` |
| Series 2 | `#eb6834` | `#d95926` |
| Series 3 | `#1baf7a` | `#199e70` |
| Series 4 | `#eda100` | `#c98500` |
| Context grey | `#97A1B0` | `#5E6B84` |
| Rise (waterfall, change bars) | series 1 | series 1 |
| Fall | series 2 | series 2 |

Use series in this order and never beyond four in one chart; beyond that, show
the top three and "Other", or use small multiples. Three of the light colours
are below 3:1 against white, which is acceptable only because every chart has
direct labels and a table view. If you change any chart colour, rerun
`validate_palette.js` from the `dataviz` skill in both modes and record the
output in the handoff.

Rise and fall use blue and orange so that colour says direction, not good or
bad. Whether a change is good depends on the metric's `direction`; say it in
words when it matters.

## 8. Motion

- One designed moment: selecting a mark. The highlight wipes across the number
  left to right in 180 ms, and the working paper content cross-fades in 120 ms.
- Panels and sheets enter in 240 ms with `cubic-bezier(0.2, 0, 0, 1)`.
- Hover and focus changes are immediate or 120 ms at most.
- Nothing animates on page load or on scroll. No scroll-linked effects, no
  smooth-scroll library, no parallax, no counters ticking up.
- With `prefers-reduced-motion`, the highlight and panels appear without
  movement.

## 9. Words

The copy is part of the design. Use the `humanizer` skill on any paragraph of
interface or page copy before committing it.

- Name things as a user would. Use these terms consistently:

| Term in the UI | Never call it |
|---|---|
| Briefing | dashboard, insights, overview |
| Ask | chat, prompt, copilot |
| Metrics | semantic model, measures |
| Data health | data quality score, profiling |
| Working paper | trace, reasoning, debug |
| AI assist | AI mode, magic, smart |
| Accuracy | evals, benchmarks |
| Use your own file | upload |

- An action keeps one name through the flow: "Add to report" then "Added to
  report".
- Errors say what happened and what to do, in the interface's voice. No
  apologies, no "Oops", no "Something went wrong". Example: "This file has no
  header row. Add column names as the first line and try again."
- Empty states invite the next action in one sentence.
- No exclamation marks. No marketing adjectives. Do not describe the product as
  AI-powered; say what it does.
- Do not join bits of meta text with dots or dashes. Write a short sentence or
  use a table.
- Dates and numbers follow `analytics-spec.md` §9.2.

## 10. States every screen needs

Design and build all five for each screen. A screen is not done with only the
ideal state.

| State | Example on the briefing |
|---|---|
| Loading | named progress line; previous content held if there is any |
| Empty | "This file has no date column, so there is no period to compare. Here are the totals." |
| Partial | findings shown, AI assist unavailable noted once |
| Error | what failed, what to do, a way back |
| Ideal | the full briefing |

## 11. Accessibility

- WCAG 2.2 AA. Text contrast 4.5:1, large text and meaningful graphics 3:1.
- Everything works by keyboard, in a sensible order. No keyboard trap. The
  working paper and sheets manage focus and close on `Esc`.
- Landmarks and one `h1` per page (the headline finding on the briefing).
- Marks, checks and status never rely on colour alone.
- Charts have a text alternative: a one-sentence summary as the accessible
  name, and the table view.
- Targets at least 24 by 24 px; 44 px for primary actions on phones.
- Respect reduced motion and forced colours.
- Page language set; numbers and dates read correctly by screen readers (use
  real minus signs and `time` elements).

## 12. What is not allowed

If the page has any of these, it is not finished.

- Gradients, glass or blur effects, glow, noise or grain textures
- Animated, WebGL or canvas backgrounds
- A warm cream page with a terracotta accent; a near-black page with one neon
  accent
- Purple or violet as an "AI" colour; sparkle or wand icons
- Chat bubbles, avatars, typing dots, a typewriter effect, rotating placeholders
- Identical rounded cards in a grid, each with the same soft shadow
- Pill-shaped tags and buttons everywhere
- All-capitals or letter-spaced labels; a small label above every heading
- Arrows appended to links and buttons
- Numbered section markers (01, 02, 03) on things that are not a sequence
- A centred hero with a vague promise and two buttons
- Entrance animations as sections scroll into view
- Shimmering skeletons
- Emoji in the interface
- Placeholder text, invented testimonials, invented logos, invented statistics
- Any number on screen that has no working paper

## 13. Checking your work

Every UI task ends with this, and the result goes in the handoff.

1. Run `npm run shots -- <routes you touched>`. It writes six images per
   route: 390, 834 and 1440 px wide, light and dark.
2. Open every image and look at it. Check, at each size:
   - nothing overlaps, clips or overflows; no horizontal page scroll
   - the hierarchy is obvious in two seconds: what is the main thing here?
   - spacing follows the scale; edges line up
   - dark mode was chosen, not inverted: no pure white text blocks, charts
     still readable
   - the five states exist (trigger each one)
   - nothing from section 12 is present
3. Tab through the screen. Focus is always visible and in order.
4. Compare with `/styleguide`. Any new colour, size or component must be added
   there or removed.
5. For tasks marked "critic pass" in `steps.md`: start a fresh subagent that
   sees only the screenshots and this file. Ask it for the five things that
   look most generic or most break these rules. Fix each or write one line in
   the handoff on why it stays.
6. Ask the last question: could this screen be mistaken for a template for any
   other data product? If yes, find what is generic and replace it with
   something that comes from this product's idea in section 1.
