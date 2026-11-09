# Bracketly redesign: phase notes (Phases 1–4)

This file replaces `PHASE1-NOTES.md`, which is now a one-line pointer here.

Branch: `redesign/phase-1` (local only; nothing pushed, deployed, or connected to live data).
Base: the live app **v2.5.4** (single-file SPA `index.html`). `/workspace/bracketly-site` was not used.
`config.js` (live backend keys) is in `.gitignore`, has never been committed, and the preview server never serves it.

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


Useful states to check (all local, PIN 1234):
- **Club Classic**: Courts, Schedule (agenda/grid, filters), Players → a profile, Chat & photos, More → Notifications, More → Share, any match (score entry, Retirement, Walkover, Correct score → history).
- **Director tools** (More → Director tools, PIN 1234): Run tournament / Setup / Permissions / Data; open a match → Move match; Setup → Look.
- **TV**: `http://127.0.0.1:8765/?join=<CODE>&tv=1` (the code is shown in More → Share).
- **Before draws are published**: Courts and Schedule pre-publication states.

---

## Phase 1: foundation (commit 86a6c0a)

### What I inspected (v2.5.4)

- **Architecture**: one `index.html` (~6.5k lines): CSS layers (golf "Roundly" yardage-book theme, then navy layer, then Bracketly additions), and one script. Rendering is string templates → `app.innerHTML` via `draw()`/`drawInner()`; actions are a click delegate on `[data-act]` → `ACT{}`; field changes on `[data-chg]` → `CHG{}`.
- **Backend** (`Dir`/`Store`): three modes: `supabase` (when `config.js` has URL + anon key), `claude` artifact DB, or `local`. Tournament data is a key/value document set: `config`, `players`, `events`, `m:<matchId>` (results), `chat:*`, `bet:*`, `su:*` (signups).
- **Routing**: `view.screen` (`land` / `wizard` / `app`) + `view.tab`. Deep links: `?join=CODE`, `#t=CODE`, `&tv=1`, `&signup=1`, `&tab=draws|courts|chat|bets|board`. A device remembers its name per tournament (`bkt:<trip>:me`).
- **Navigation (live)**: header = tournament logo + uppercase name + dates/club, then icons for Pick name, Alerts, Share, Director. Bottom tabs: Home / Courts / Draws / **Bets** (or Players when bets are off) / Chat.
- **Permissions**: `view.admin` comes from the trip role or the director PIN (`claim_admin` RPC on Supabase). `canScore() = admin || config.openScoring !== false`, so by default **anyone with the join code can score**. Picking a name is display personalization only. Server-side enforcement was not verified.
- **Formats** (`FORMAT_LABELS`): round robin, single elim, single elim + consolation, double elim (winners/losers/grand final), multi-pool → playoff, Pro-Am flights, Club Cup (team vs team sessions with points). Seeds (`team.seed`), byes (`propagateAutoWalkovers`), feeder labels ("Winner of QF 1", "Pool A #1").
- **Scoring** (`SCORING_FORMATS`, `getScoreStructure`): tennis Bo3 + 10-pt MTB, Bo3 full, pro 8, pro 10, one set, MTB only; pickleball game to 11/15/21, Bo3 to 11. Main vs consolation formats per event. Pro-Am uses a single "games (pro set)" row stored as `{t1,t2}`.
- **Score save rule (`ACT.savescore`)**: empty trailing rows are dropped; whoever wins more rows wins; no further validation (no tennis set-score checks). Stored as `m:<id> = {w, s:[[a,b],…], by, ts, names, ev, txt}`, then bets settle and an auto chat line is posted. `setwin` = walkover/retirement with `s:null, note:'Walkover or retired'`. `clearres` deletes the result after a confirm. `setlive` toggles "on court".
- **Theme**: directors pick a preset/fonts/corners/borders/density in Setup → Look (`cfg.style`); `applyTheme()` writes CSS variables. Default preset was `court`, fonts Fraunces + Manrope (+ IBM Plex Mono for metadata).

### What changed (all in `index.html` unless noted)

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

### What was preserved in Phase 1

The data model, storage keys, sync, Supabase RPC calls, bracket/schedule engine, scoring formats and the winner rule, the stored result shape, auto chat lines, bet settlement, permissions (`canScore`, director PIN), walkover/retirement and clear-result semantics, publish/unpublish (director only, unchanged), the wizard and director screens, TV mode, print layouts (print and TV keep the original bracket markup), signup, chat/photos, alerts/push, the directors' theme presets and custom colors, and every existing deep link. Courts, players, chat, bets, and notifications screens only pick up the shared tokens.


---

## Phase 2: courts, players, schedule, chat, notifications

All in `index.html`, in the block `/* ================= Phase 2: courts, players, schedule, chat, notifications */` plus CSS under `/* ================= Phase 2-4 redesign */`.

- **Courts** (`courtsView`): one compact row per court with the court name, a text status, current teams and the next assignment. Filters All / Playing / Upcoming (`aria-pressed`). Shows the date context ("Today, … · updated 2:10 PM", or "No play today" with the tournament days). Statuses:
  - "Match in progress" (someone marked it on court)
  - "Scheduled now" (its slot is now but nobody has marked it)
  - "No match in progress"
  Future assignments are labelled "Next assignment · Sat 8:00 AM". The app never says "Available" or "Open", because it doesn't know whether a court is bookable; a footnote says so. Before publication it says "Court assignments show here once the director publishes the draws."
- **Players** (`playersView`, `playerSheet`): labelled search plus Division and rating filters (rating only shows when players have more than one distinct rating), a "Showing N of M" status, and compact rows with You / Following tags. The profile shows the next match first, then later matches, then results with Won/Lost text. **Follow** (a toggle with `aria-pressed`, plus "they aren't told") is separate from **"Is this you? Use this name on this device"** (copy says it doesn't sign you in or prove identity). No rankings, win percentages, or verified badges.
- **Schedule** (`scheduleView`, `schedGridView`, `placeLink`):
  - Mobile agenda first: day picker with dates, Event and Court filters, "My matches only" (when a name is picked), Clear filters.
  - **Grid view** (time × court table, sticky headers, bounded scroll region) is the alternate view. It works at any width; on mobile it scrolls inside its own box.
  - The director's club events (`extras`: lunch, party, awards…) are mixed into the agenda as "Club event" rows. They hide while a filter is on, so matches are never pushed aside.
  - **Changed states:** "Time changed", "Court changed", or "Time and court changed" with "Was Sun 8:00 AM" show only for matches moved with Move match from now on (new optional `moved` field, see Phase 3). Older moves have no record, so nothing is shown for them. "Postponed" is **not** shown: there's no data for it.
  - Internal places such as "Court 1" or "Clubhouse" link to the **venue address** for maps ("Clubhouse · Venue map"); real addresses link to themselves.
- **Chat & photos** (`chatView`, `composer`, `photoWall`, `addPhotos`, `ACT.send`):
  - The latest director announcement is pinned (sticky) at the top. Messages from the same sender within 5 minutes are grouped under one name/time.
  - A "New messages" divider shows at the point you'd last read up to (captured when you open Chat).
  - The composer sits above the nav, with a labelled 44px photo button and "Message the tournament". Sending only happens on Send or Enter, as before.
  - New states: "Sending…" / "Uploading photo…" (inputs disabled while sending); a failed photo upload keeps your text and photo and shows an error instead of silently dropping the message; photo wall progress "Adding 2 of 5…" plus a partial-failure message; empty states.
  - There is no separate chat loading state: the app-wide "Loading the tournament…" screen covers it.
- **Notifications** (`alertsSheet`):
  - A "Delivery on this device" block shows three things separately: Browser permission (Allowed / Blocked / Not asked yet / Not supported), While Bracketly is open (Showing alerts / In-app banners only), and When the app is closed (On / Off / Not available).
  - Copy says the switches only choose *what* you hear about; delivery depends on the browser and push.
  - Preferences are grouped My matches / Followed players / Tournament / Social, as switch rows (`role="switch"`), using the same `ALERTS` keys and `CHG.alertset`.
  - Buttons: Allow notifications, Stop showing alerts, closed-app alerts on/off, Show a test alert. The test is a local notification only, and only shows once permission is granted.

## Phase 3: director, Look, rescheduling, share/TV/print, landing

Block `/* ================= Phase 3: … */` in `index.html`.

- **Director workspace** (`adminView`):
  - "‹ Return to the tournament" link, the tournament name and join code, and sections **Run tournament / Setup / Permissions / Data**.
  - **Run tournament**: counts for draws published, results in, and marked on court; a scheduling-conflict warning from the existing `detectConflicts()` + `doubleBooked()`; the missing-setup card; links to schedule, draws/publication, scores, and share/TV/print. Announcements now go through **Review and send…** (a confirm dialog shows the exact text) instead of sending on the first tap.
  - **Setup**: one row per wizard step with a Done / To do chip, plus Look.
  - **Permissions**: the open-scoring policy is stated in words ("Open scoring is on. Anyone with the join code can enter and correct scores…"), next to its switch. Also director PIN guidance, Lock on this device, and the Bets switch.
  - **Data**: live sync, export/import. **Fill demo / Clear scores / bets / chat / Delete tournament** moved into a collapsed "Bulk and destructive actions" disclosure. Each still asks to confirm.
  - Diagnostics (version, storage mode, code) sit in a disclosure.
  - The wizard header button now reads "Return to tournament".
  - START-HERE §19–27 were applied only as far as the existing forms allow: structure, copy and states. The setup forms (basics, events, players, brackets, courts, schedule, welcome) are the v2.5.4 forms on the new tokens. Their field-level redesign isn't done.
- **Look** (`wzStyle`, `styleEdit`, `ACT.style*`):
  - Choosing a preset, font, layout option or custom color now changes **only a local draft** (`view.styleDraft`), previewed on this device.
  - A sticky bar offers **Apply for everyone** (confirm dialog, then writes `cfg.style`), **Cancel preview**, and **Courtside preset** (also a draft). A status line says whether you're previewing.
  - Leaving the Look step or closing setup discards an unapplied draft, with a toast.
  - Before, every tap wrote to the live config straight away.
- **Rescheduling** (`moveSheet`, `CHG.mvprev`, `stampMoved`, `ACT.domove/unpin`):
  - Current vs proposed cards update as you pick a time or court. "Confirm move" is disabled until something changes.
  - Warnings:
    - the occupant swap (who moves where)
    - the occupant already has a result
    - players we know are double-booked at the new time (using the existing known-player helper)
    - double-booking caused by the swap
    - the new time has already passed
  - It lists affected players and the notification consequence ("Players with My matches alerts see a moved alert when their phone next syncs… Nothing is sent until you confirm").
  - Moves still use the existing `setMatchSlot()`. Each moved match now also records `moved:{from:{when,court},at}` in `events`. That's an optional field the old app ignores, and it's cleared if the match goes back to where it started.
- **Share** (`shareCards`): labelled destinations, each with its purpose and a state chip:
  - **Player**: "N draws published" / "No draws published yet"
  - **TV**: Ready / Will show courts only, plus an Open TV screen button
  - **Signup**: Open / Closed; the link only appears when signups are open, and they weren't enabled
  - **Print**
  Each destination has a copy button and QR code.
- **TV** (`tvView`): date and venue in the header; three columns (Courts / Up next / Results) at large type; at most 6 courts (+ "N more"), 4 up next and 4 results, so content stays bounded; day shown when the next match isn't today; the same honest court statuses; draw slides scaled up 1.3×. Checked at 1280×720.
- **Print**: unchanged layout. Added print CSS so the nav is hidden and each event starts on a new page. **Not verified on paper or in a PDF.**
- **Landing / switcher** (`landingView`, startup):
  - **Join a tournament** is the first, player-first action. Below it: Recent tournaments as compact rows, then Organizers (Run a tournament, Look around a sample, and local-only preview samples).
  - Server errors show as a short note. Backend, version and Supabase hints moved into a Diagnostics disclosure.
  - **Deep links**: `?join=CODE` / `#t=CODE` now show "Opening tournament CODE…" from the first paint until the code resolves; a bad code falls back to the landing page with the existing error. All existing deep links are unchanged.

## Phase 4: scoring (backward-compatible)

Block `/* ================= Phase 4: format-aware scoring */` in `index.html`.

- **Format-aware validation** (`rowRule`, `rowProblem`, `checkScoreRows(raw, m)`). The rules come from the match's real format (`getScoringFormatKey`: main vs consolation per event):
  - Sets to 6: 6–0…6–4, 7–5, 7–6.
  - Pro 8 / pro 10: 8–0…8–6, 9–7, 9–8 / 10–0…10–8, 11–9, 11–10.
  - 10-point match tiebreak, and pickleball games to 11/15/21: reach the target, win by 2, and past the target the margin must be exactly 2.
  - Best of three: needs two rows; one set each requires the decider; the decider must be blank after straight sets.
  - Both sides must be filled in a row, with values 0–99.
  - Pro-Am stays free-form (games won), as before.
  - Errors are plain-language ("Set 1: 6–5 isn't a finished set…").
  - **Directors** get "Director: review anyway" for local rules the app doesn't model. The result is saved with `override:true` and labelled "Saved by a director outside the usual format rules." Players can't override.
- **Deciding column auto-off**: in best-of-three formats, once sets/games 1 and 2 go the same way, the 3rd column's inputs are disabled (and cleared) with a "not needed" status line, and focus stays where you were typing. Review and read-only views drop that column. Split sets keep it and require it.
- **Retirement and Walkover are separate forms** (`ACT.scmode/retpick/retreview/saveret/savewo`):
  - **Retirement**: choose who retired, then enter the score when play stopped (keeps the typed rows, partial sets allowed, both-or-neither per row), review, then confirm. Stored as `{w, s:<partial rows or null>, note:'<team> retired', outcome:'retired', retired:'team1|team2', …}`.
  - **Walkover**: choose who advances, confirm. Stored as `{w, s:null, note:'Walkover', outcome:'walkover', …}`.
  - Club Cup still stores `A`/`B`.
- **States and attribution**:
  - The read-only chip shows **Final**, or **Corrected** when the record has replaced an earlier one. Lists show "Final · corrected". There's also a Retired / Walkover chip.
  - **Pending · not saved yet** is shown during review. A stored "pending confirmation" state was **not** added: it would change how results advance draws and settle bets.
  - Attribution reads "Entered by X at 2:06 PM", or "First entered by … Corrected by … at …".
- **Correction history** (`writeResult`): saving over an existing result stores the earlier version in `hist` (last 10) and sets `corrected:true`. The view shows a "Correction history (n)" disclosure, which notes that history starts from this version. Nothing is invented for old records. **Clear result** still deletes the record, including its history (the copy says so).
- **Old records** read as before: `{w, s}` → Final, `{w, s:null, note:'Walkover or retired'}` → Final with the note and no empty table. The engine, bets, standings and push functions read the same `w`/`s` fields. Every new field is optional.
- Unchanged: auto chat result lines, bet settlement, `setlive`, `clearres`, and the old `ACT.setwin/confirmwin` (still present, no longer linked).
- Not added: payments, new formats, signups, announcements. Bets stays under More and only shows when enabled.

## QA done (local preview only)

- `scoretest2.py` (Playwright, Supabase blocked) covered:
  - 6–5 rejected; guests get no override
  - straight sets disable the MTB with focus kept; review is 2 columns; the stored shape is `{w, s:[[6,4],[6,2]]}` with no extra fields
  - a correction writes `hist` (1 entry) and `corrected`, and shows "Corrected"
  - split sets require the MTB, and 10–9 is rejected
  - retirement keeps partial rows and requires choosing a side
  - walkover confirm
  - legacy walkover and score records render
  - director override saved with `override:true`
  - rule unit checks for 7–6, 9–7, 12–10 (ok) and 6–5, 8–7, 12–9, 15–14 (rejected)
- `flow3.py` covered:
  - Move preview (confirm disabled until changed, swap warning, affected players), with `moved` recorded and "Time changed" status
  - announcement cancel sends nothing
  - chat send, and a failed photo upload keeping the draft
  - `?join=` good and bad codes
  - pre-publication courts
- `audit2.py` at **320 / 390 / 430 / 1280**: every tab, schedule grid, photos, the Notifications / Player / Share / Match sheets, the four director sections, Move, Look, TV and print. No page-level horizontal overflow (fixed one: screen-reader captions inside the grid escaped their scroll box), no JS errors. The only sub-44px items flagged are visually-hidden labels (1×1, not targets).
- Screenshots: `/workspace/shots/p2-*`, `p3-*`, `p4-*`.
- Not tested: real devices, VoiceOver/TalkBack, 200% zoom, real print/PDF output, pickleball or Pro-Am events end to end, real tournament data, live push delivery.

## Behavior changes to review before going live

Phase 1's list still applies (see below). New in Phases 2–4:
1. **Score entry is stricter.** Scores the old app accepted (e.g. 6–5 sets, 10–9 tiebreaks, a lone set in a best-of-three) are now rejected unless a director overrides. Check local rules (e.g. 8-game pro sets with no tiebreak, short sets) before launch.
2. Retirement and walkover are now separate and store `outcome`, `retired`, and partial scores. Anything reading `note === 'Walkover or retired'` will see "Walkover" or "<team> retired" for new results.
3. Corrections keep up to 10 earlier versions in the `m:` record, so records get a little larger.
4. **Look no longer applies on tap.** Directors must press Apply for everyone.
5. Announcements need a confirm step.
6. Destructive data actions are one disclosure deeper.
7. Moves write a `moved` field into `events` (harmless to v2.5.4).
8. Courts never say "Open" or "Available".
9. Landing order changed: join first, organizer tools below, diagnostics hidden.

## Phase 1 blockers and uncertainties (still relevant)


- **This changes live appearance and IA when deployed.** Tournaments without a saved Look preset switch from `court` to `courtside`. All tournaments get thin borders, sentence case, and no mono metadata. Bets and Chat move from the tab bar into More. Scoring gains a review step, and walkover gains a confirm. This needs product review before any deploy.
- Not checked against real LBK/Q9XX6B data: the preview never connects to Supabase. Long names, 14 divisions, and 100 players were only simulated with sample data.
- No elimination draw with real results, consolation progression, pickleball event, or Pro-Am sample was exercised in the browser beyond the Classic sample. Their row rendering and score columns come from the same code paths but weren't checked end to end.
- Layout checked at 320, 390, and 1280 widths (no page-level horizontal overflow, 44px targets on the main screens). Not tested: 200% browser text zoom, VoiceOver/TalkBack, real iOS safe areas. On desktop the nav spans full width; a desktop-specific layout is open.
- The production manifest `theme_color` (#023221) is unchanged; the page `<meta name="theme-color">` default is now #123C2F (applyTheme overrides it per tournament anyway).
- `tools/serve-preview.py` and the local-only sample links are safe to ship (the links only render in local mode), but you can drop them before merging.

