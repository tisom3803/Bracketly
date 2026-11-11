# Smart import tests (v3.1.0)

`smart-import.js` (repo root) is the spreadsheet reader the app uses. These tests run it against messy files in `fixtures/`
(built by `make_fixtures.py`, fake names only):

| File | What's messy |
|---|---|
| 01_google_form.csv | Google Form export: timestamp, checkbox list of events in one cell, separate doubles / mixed partner columns, TBD, partner with no row |
| 02_title_rows.xlsx | Title rows above the header, "Last, First" and ALL CAPS names, event strings and codes (WD 3.5, XD 7.0, MS 4.5), repeated rows, blank rows, total row |
| 03_multi_sheet.xlsx | One tab per division (tab name is the division), instructions tab, team rows, no M/F column |
| 04_checkboxes.xlsx / 04b_checkboxes.xls | Singles / Doubles / Mixed columns with X / yes / partner names, same email under "Bob" and "Robert", repeated row, "need partner" |
| 05_sections.csv | No header row, division title rows inside the sheet, tiers (Men's B), age groups (Boys 14U) |
| 06_paste_no_sex.tsv | Pasted tab table, no M/F column, two events in one cell, "w/ partner" inside the event cell |
| 07_typos_codes.xlsx | Typo headers (Gnder, Parnter, Skill Lvl), event codes + per-player levels, WTN / UTR, 40+ age group |
| 08_plain_roster.csv | Plain roster with no events |

Run: `node --test tools/import-tests/import.test.js` (from the repo root). `node tools/import-tests/dump.js <fixture>` prints what was found.
