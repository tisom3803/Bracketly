# Bracketly redesign — Phase 1 notes

Branch: `redesign/phase-1` (local only, nothing pushed or deployed).
Base: the live app **v2.5.4** from bracketlyapp.netlify.app (single-file SPA `index.html`).
Not used as base: `/workspace/bracketly-site` (separate TEST build from getbracketly.com).
`config.js` (live backend keys) is in `.gitignore`, was never committed, and is not read by the preview server.

## How to preview

```bash
cd /workspace/bracketly-redesign
python3 tools/serve-preview.py 8765      # background: nohup python3 tools/serve-preview.py 8765 >/tmp/bk-preview.log 2>&1 &
# open http://127.0.0.1:8765/
```

`tools/serve-preview.py` answers `/config.js` with an empty config, so the app runs in
**"This device only"** mode (browser localStorage). It cannot reach the live Supabase
project, cannot open real tournaments (Q9XX6B, VMMTVC), and nothing typed in the preview leaves the browser.
Do **not** preview with a plain static server in this folder; that would load the real `config.js` and connect to live data.

The landing page gets three sample entry points in local mode only (the two new links never show when a live backend is configured):

| Link | What it shows |
|---|---|
| Look around a sample: the Oak & Pheasant Cup | Existing v2.5.4 sample: Club Cup, 6 courts, completed and upcoming matches. Opens in director mode (PIN 1234). Use Director tools → Lock for the player view. |
| Local preview: Club Classic (brackets and pools) | Existing (previously unused) `buildSampleClassic()`: single elim + consolation, round robin, double elim, pool play → playoff. Opens as a player. |
| Local preview: Before draws are published | Same Classic data with every draw unpublished and no results: the pre-publication home and "Draw not published" states. |

Director PIN for all local samples: 1234.

## What I inspected (v2.5.4)

- **Architecture**: one `index.html` (~6.5k lines): CSS layers (golf "Roundly" yardage-book theme, then navy layer, then Bracketly additions), and one script. Rendering is string templates → `app.innerHTML` via `draw()`/`drawInner()`; actions are a click delegate on `[data-act]` → `ACT{}`; field changes on `[data-chg]` → `CHG{}`.
- **Backend** (`Dir`/`Store`): three modes: `supabase` (when `config.js` has URL + anon key), `claude` artifact DB, or `local`. Tournament data is a key/value document set: `config`, `players`, `events`, `m:<matchId>` (results), `chat:*`, `bet:*`, `su:*` (signups).
- **Routing**: `view.screen` (`land` / `wizard` / `app`) + `view.tab`. Deep links: `?join=CODE`, `#t=CODE`, `&tv=1`, `&signup=1`, `&tab=draws|courts|chat|bets|board`. A device remembers its name per tournament (`bkt:<trip>:me`).
- **Navigation (live)**: header = tournament logo + uppercase name + dates/club, then icons for Pick name, Alerts, Share, Director. Bottom tabs: Home / Courts / Draws / **Bets** (or Players when bets are off) / Chat.
- **Permissions**: `view.admin` comes from the trip role or the director PIN (`claim_admin` RPC on Supabase). `canScore() = admin || config.openScoring !== false`, so by default **anyone with the join code can score**. Picking a name is display personalization only. Server-side enforcement was not verified.
- **Formats** (`FORMAT_LABELS`): round robin, single elim, single elim + consolation, double elim (winners/losers/grand final), multi-pool → playoff, Pro-Am flights, Club Cup (team vs team sessions with points). Seeds (`team.seed`), byes (`propagateAutoWalkovers`), feeder labels ("Winner of QF 1", "Pool A #1").
- **Scoring** (`SCORING_FORMATS`, `getScoreStructure`): tennis Bo3 + 10-pt MTB, Bo3 full, pro 8, pro 10, one set, MTB only; pickleball game to 11/15/21, Bo3 to 11. Main vs consolation formats per event. Pro-Am uses a single "games (pro set)" row stored as `{t1,t2}`.
- **Score save rule (`ACT.savescore`)**: empty trailing rows are dropped; whoever wins more rows wins; no further validation (no tennis set-score checks). Stored as `m:<id> = {w, s:[[a,b],…], by, ts, names, ev, txt}`, then bets settle and an auto chat line is posted. `setwin` = walkover/retirement with `s:null, note:'Walkover or retired'`. `clearres` deletes the result after a confirm. `setlive` toggles "on court".
- **Theme**: directors pick a preset/fonts/corners/borders/density in Setup → Look (`cfg.style`); `applyTheme()` writes CSS variables. Default preset was `court`, fonts Fraunces + Manrope (+ IBM Plex Mono for metadata).

## What changed (all in `index.html` unless noted)

1. **Design tokens**
   - New `courtside` preset with the approved palette (forest #123C2F, ivory #F7F5EC, surface #FFFEF8, ink #19382D, muted #5E6C62, border #DEDFD4, gold #AD9258, soft green #E6EEE5, soft gold #F0E8D4 / #705B2E). It is the **default for tournaments that never chose a preset** and appears as a choice in Setup → Look.
   - `applyTheme()` adds `--bd` (thin neutral border), `--muted`, `--ok-bg`, `--warn-bg`, `--warn-ink`; `--line` now maps to the neutral border; `--fm` maps to the body sans, which removes monospaced metadata (real mono kept as `--mono`). Other presets derive the same tokens from their own colors.
   - A final CSS layer, "Phase 1 redesign": 4/8/12/16/24 spacing, 12px cards, 10px controls, 44px minimum targets, 16px inputs, visible focus ring (forest; ivory on dark surfaces), sentence case (uppercase transforms removed), thin borders and light shadows on shared cards, and destructive buttons in semantic red only. Fonts stay Fraunces (headings) + Manrope (body). Scores use tabular numbers.
2. **Header and navigation**
   - Header (64px, forest with gold trim): the existing Bracketly crest plus the text "Bracketly" (plain text, not a new logo), the sync/offline pill, Notifications, and More. Share, director, and identity moved to More.
   - Readable tournament context row at the top of each page: tournament logo if set, full name (wraps, never truncated), short dates and club.
   - Bottom nav: **Home / Courts / Draws / Schedule / More**, the same five positions on every player screen, with `aria-current`, text labels, 52px targets, and safe-area padding. The live-court count badge stays on Courts. The More badge counts unread chat plus bets waiting on you, and its accessible label says which.
   - **More** page: Players, Chat & photos, Notifications, Share, Tournament information, Friendly bets (only when `bets` is on), Viewing as / Pick your name, Director tools, All tournaments, plus diagnostics (version and storage mode).
   - **Director workspace**: on the Director tab the player nav is hidden, the header shows "Return to tournament", and the context row says "Director workspace". Director content is unchanged (that's Phase 3).
   - New tab ids `schedule`, `more`, `info`; deep links `?tab=schedule|more` added. The old `chat`, `bets`, `players`, and `admin` tabs and links all still work.
3. **Home**
   - *Before publication*: "Tournament weekend / See you courtside.", then the first-ball date and time with a one-line "Starts in N days" (no countdown tiles). A "Draws are coming." card ("Match times and opponents will appear here once the director publishes the draws."), one profile action (Find your player profile, or View your player profile), "At a glance" (division count with event mix, player count, weekend schedule), and collapsible tournament information. No invented courts or publication dates.
   - *Active*: "Your next match" first (time, day, court, event, round, opponents), then On court now, then Today's matches (or Coming up before play starts) with a Full schedule link, then collapsible information (welcome message, arrival and parking, food, dress, awards, events and formats, rules, rain plan, contacts). The weekend itinerary moved to Schedule. Open/closed state of each section survives the app's 30-second refresh.
   - The install hint moved to a quiet dismissible line at the bottom. Cover photo, photo strip, and sponsors are kept.
4. **Schedule tab** (minimal; the full agenda redesign is Phase 2): reuses the existing day-grouped match list with an `aria-pressed` day picker and time-group headings, a "waiting for a time" note, and "The weekend" (existing `weekendItems()`, including off-court extras). Before publication it says "Match times aren't out yet".
5. **Draws**
   - Division selector button (name, format, division count, publication state) opens a dialog with search (shown when there are more than 5 divisions), so 14 divisions stay usable on mobile.
   - Publication state is a text chip: Published / Draw not published (players) / Not published or Not drawn yet (directors). Players see **"Draw not published"** instead of "0 teams". Directors see a "Not published. Only directors can see this draw." note.
   - Elimination (single, single + consolation, double): section switch (Main draw / Consolation, or Winners / Losers / Grand final) plus a round switch (Round 1 / Quarters / Semis / Final …). The default is the first round still in play. One round shows as match cards, and the scoring format line sits underneath. "View full bracket" shows the existing column tree inside a bounded, keyboard-focusable horizontal scroll region.
   - Club Cup stays team totals plus session groups (session name and start time in the heading), **not** an elimination tree. Round robin, pools (playoff tree bounded), and Pro-Am keep standings tables (now with captions and header scopes) and use the new rows.
   - **Consistent two-team match rows** everywhere `matchRow` is used (home, schedule, draws, courts "Just finished", player sheet): a time · court line, a text status chip (Final, On court, Scheduled now, Awaiting result, Bye, Time to be set), event and round context, then two team rows with seed, names (wrapping), winner check, and per-set score columns aligned on tabular numbers. Each row has a full accessible label (teams, result, time and court). Seeds, byes, and feeder labels come from the existing engine.
6. **Match details and score entry** (`matchSheet`)
   - Dialog with `role="dialog"`, labelled heading, 44px Close button, and Escape to close. The meta line shows full day · time · court plus the configured format label for that match (main vs consolation, sport-specific).
   - **Teams as rows, sets as columns** (`<table>` with column/row headers; each input labelled e.g. "Set 1, Lainey Brooks / Hadley Stone"). Columns come from the existing `getScoreStructure()`, so tennis, pickleball, pro sets, MTB-only, and Pro-Am each show their own columns.
   - Read-only view (status, saved score, "Entered by … at …") is separate from editing. An unplayed match a scorer can edit opens straight into entry; a match that has a result opens read-only with **Correct score**.
   - **Review → confirm**: Review result runs the *same* rule as v2.5.4 (`checkScoreRows`, extracted from `savescore`) and shows "Not saved yet. X def. Y 6–4, 3–6, 10–7" with a read-only table, then **Confirm and save** or **Edit score**. Errors show inline. Saving writes exactly the same `m:<id>` record as before (verified in the preview). Values typed into score fields survive background redraws.
   - Rules hint states the real behavior ("Leave 10-pt MTB blank if the match was decided in two sets. The team that wins more sets is recorded as the winner."). It doesn't claim validation the app doesn't do.
   - **Retirement or walkover** is its own collapsible form, with a confirmation dialog that says no set scores are kept. The underlying `setwin` is unchanged.
   - **Clear result** is a separate destructive section at the bottom (red outline, explanation, existing confirm dialog) and only shows when a result exists and the user can score. "Mark on court now" stays as a secondary action. Directors keep "Move match".
7. **Identity gate**: "Continue as spectator" sits above the search box and list, the search has a label, and the copy explains that picking a name personalizes the device and doesn't verify identity.
8. `tools/serve-preview.py`: the local-only preview server (new file). `.gitignore`: `config.js`.

## What was preserved

The data model, storage keys, sync, Supabase RPC calls, bracket/schedule engine, scoring formats and the winner rule, the stored result shape, auto chat lines, bet settlement, permissions (`canScore`, director PIN), walkover/retirement and clear-result semantics, publish/unpublish (director only, unchanged), the wizard and director screens, TV mode, print layouts (print and TV keep the original bracket markup), signup, chat/photos, alerts/push, the directors' theme presets and custom colors, and every existing deep link. Courts, players, chat, bets, and notifications screens only pick up the shared tokens.

## Proposed but not implemented (later phases or needs approval)

- **Phase 2**: compact Courts rows and filters, Schedule agenda with filters and changed-time/court states, player directory/profile (next match first), chat/photo states and pinned announcements, notification grouping (preference vs browser delivery).
- **Phase 3**: director structure (Run / Setup / Permissions / Data), Look preview → Apply, reschedule review with conflicts, Share/TV/Print redesign, entry/switcher (landing) redesign.
- **Phase 4 / needs product decisions**:
  - Format-aware score validation (e.g. reject 6–5 in a set, require a MTB to 10 win-by-2). Today any score with a row winner is accepted; I didn't change that.
  - Separate retirement vs walkover outcomes that *keep partial scores*. Today one action stores `s:null`, which would need a data-model change.
  - Final / Pending / Corrected states and a correction history. Only "Entered by / at" exists today.
  - Hiding the deciding-tiebreak column automatically after straight sets.
  - Payments: none exist in the app. Nothing was built; "Payments" isn't shown in More.
  - Bets: only relocated under More (still conditional on the director's switch). No flow changes.
- The text "Bracketly" beside the crest is plain text pending real brand files. No new logo was made.

## Blockers and uncertainties (read before going live)

- **This changes live appearance and IA when deployed.** Tournaments without a saved Look preset switch from `court` to `courtside`. All tournaments get thin borders, sentence case, and no mono metadata. Bets and Chat move from the tab bar into More. Scoring gains a review step, and walkover gains a confirm. This needs product review before any deploy.
- Not checked against real LBK/Q9XX6B data: the preview never connects to Supabase. Long names, 14 divisions, and 100 players were only simulated with sample data.
- No elimination draw with real results, consolation progression, pickleball event, or Pro-Am sample was exercised in the browser beyond the Classic sample. Their row rendering and score columns come from the same code paths but weren't checked end to end.
- Layout checked at 320, 390, and 1280 widths (no page-level horizontal overflow, 44px targets on the main screens). Not tested: 200% browser text zoom, VoiceOver/TalkBack, real iOS safe areas. On desktop the nav spans full width; a desktop-specific layout is open.
- The production manifest `theme_color` (#023221) is unchanged; the page `<meta name="theme-color">` default is now #123C2F (applyTheme overrides it per tournament anyway).
- `tools/serve-preview.py` and the local-only sample links are safe to ship (the links only render in local mode), but you can drop them before merging.
