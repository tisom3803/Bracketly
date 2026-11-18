"""Builds the messy test spreadsheets for the smart-import tests. Fake names only."""
import csv, openpyxl, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
os.makedirs(D, exist_ok=True)

# 1. Google Form export: checkbox list of events, separate doubles/mixed partner columns, TBD, partner who never registered
rows = [
 ['Timestamp','Email Address','First Name','Last Name','Gender','NTRP Rating','Which events are you entering?','Doubles Partner','Mixed Doubles Partner','Phone Number','T-Shirt Size'],
 ['10/1/2026 9:14:02','amy.fox@example.com','Amy','Fox','Female','3.5','Singles, Doubles, Mixed Doubles','Beth Gale','Carl Hunt','(806) 555-0101','M'],
 ['10/1/2026 9:20:11','beth.gale@example.com','Beth','Gale','Female','3.5','Doubles','Amy Fox','','806-555-0102','S'],
 ['10/1/2026 10:02:45','carl.hunt@example.com','Carl','Hunt','Male','4.0','Doubles, Mixed Doubles','Dan Irving','Amy Fox','806.555.0103','L'],
 ['10/2/2026 8:00:00','dan@example.com','Dan','Irving','Male','4.0','Doubles','','','8065550104','XL'],
 ['10/2/2026 8:30:00','erin.j@example.com','Erin','Jones','F','3.0','Singles, Doubles','TBD','','806 555 0105','M'],
 ['10/2/2026 9:00:00','fred@example.com','Fred','Klein','M','4.5','Singles','','','',''],
 ['10/3/2026 7:45:00','gina@example.com','Gina','Lowe','F','3.5','Doubles, Mixed Doubles','Hana Moss','Ivan Nash','',''],
 ['10/3/2026 7:50:00','ivan@example.com','Ivan','Nash','M','3.5','Mixed Doubles','','Gina Lowe','',''],
 ['','','','','','','','','','',''],
]
with open(os.path.join(D, '01_google_form.csv'), 'w', newline='') as f: csv.writer(f).writerows(rows)

# 2. Title rows, header on row 4, "Last, First" names, combined event strings & codes, blank rows, total row
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Entries'
for r in [
 ['Lubbock Fall Classic 2026'], ['Entry list as of Nov 1'], [],
 ['Player', 'M/F', 'Level', 'Event', 'Partner', 'USTA #'],
 ['Smith, John', 'M', '4.0', "Men's 4.0 Doubles", 'Lee, Bob', '2010123456'],
 ['Lee, Bob', 'M', '4.0', "Men's 4.0 Doubles", 'John Smith', '2010123457'],
 ['GARCIA, MARIA', 'F', '3.5C', 'WD 3.5', 'Patel, Nina', '2010123458'],
 ['Patel, Nina', 'F', '3.5', 'WD 3.5', 'Maria Garcia', ''],
 [],
 ['Smith, John', 'M', '4.0', 'XD 7.0', 'Patel, Nina', '2010123456'],
 ['Patel, Nina', 'F', '3.5', 'XD 7.0', 'John Smith', ''],
 ['Ortiz, Leo', 'M', '4.5', 'MS 4.5', '', '2010123459'],
 ['Quinn, Rae', 'F', '4.5', "Women's 4.0 Singles", '', ''],
 ['Total: 6 players'],
]: ws.append(r)
wb.save(os.path.join(D, '02_title_rows.xlsx'))

# 3. One sheet per division, team rows, no sex column, an instructions sheet
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Read me'
ws.append(['Instructions']); ws.append(['Fill in one team per row on each division tab.'])
for title, teams in [
 ("Men's 3.5 Doubles", [['Tom Reed', 'Uri Vance', '3.5', '3.5'], ['Will Xu', 'Yuri Zane', '3.0', '3.5']]),
 ("Women's 4.0 Doubles", [['Ava Bell', 'Cara Dunn', '4.0', '4.0'], ['Eve Ford', 'Gia Hart', '4.0', '3.5'], ['Ivy Jost', 'TBD', '4.0', '']]),
 ('Mixed 7.0', [['Tom Reed', 'Ava Bell', '3.5', '4.0'], ['Kai Lund', 'Mia Ness', '', '']]),
]:
    w = wb.create_sheet(title); w.append(['Player 1', 'Player 2', 'Rating 1', 'Rating 2'])
    for t in teams: w.append(t)
wb.save(os.path.join(D, '03_multi_sheet.xlsx'))

# 4. Checkbox columns per event, partner names inside the event columns, repeated row, same email different spelling
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Signups'
for r in [
 ['Name', 'Sex', 'Rating', 'Email', 'Singles', 'Doubles', 'Mixed'],
 ['Robert Stone', 'M', '4.0', 'rstone@example.com', 'X', 'Paul Tran', 'Lisa Ward'],
 ['Paul Tran', 'M', '4.0', 'ptran@example.com', '', 'Robert Stone', ''],
 ['Lisa Ward', '', '3.5', 'lward@example.com', 'yes', 'Kim Yates', 'Bob Stone'],
 ['Kim Yates', 'F', '3.5', 'kyates@example.com', '', 'Lisa Ward', 'need partner'],
 ['Bob Stone', 'M', '4.0', 'rstone@example.com', '', '', ''],
 ['Sam Ochoa', '', '', '', 'X', '', ''],
 ['Paul Tran', 'M', '4.0', 'ptran@example.com', '', 'Robert Stone', ''],
]: ws.append(r)
wb.save(os.path.join(D, '04_checkboxes.xlsx'))

# 5. Section header rows inside the sheet, no header row at all, tiers and age groups
with open(os.path.join(D, '05_sections.csv'), 'w', newline='') as f:
    csv.writer(f).writerows([
     ["WOMEN'S 3.0 DOUBLES", ''], ['Jessica McFall', 'Rebekah Phillips'], ['Katherine Byrne', 'Natalie Butler'], ['', ''],
     ["Men's B", ''], ['Oscar Diaz', 'Pete Ellis'], ['Quentin Fry', 'Raj Gupta'],
     ['Boys 14U Singles', ''], ['Sammy Hall', ''], ['Tyler Inman', ''],
     ['Mixed 8.0', ''], ['Ali Hamilton', 'Kerry Thompson'],
    ])

# 6. Pasted (tab separated) with no sex column, several events in one cell, repeated rows for more events
with open(os.path.join(D, '06_paste_no_sex.tsv'), 'w') as f:
    for r in [
     ['Name', 'Event(s)', 'Partner'],
     ['Greg Adams', "Men's 3.5 Doubles", 'Hank Burns'],
     ['Hank Burns', "Men's 3.5 Doubles; Mixed 7.0", 'Greg Adams'],
     ['Hank Burns', 'Mixed 7.0', 'Jill Cole'],
     ['Jill Cole', 'Mixed 7.0', 'Hank Burns'],
     ['Taylor Dean', 'Open Singles', ''],
     ['Megan Ellis', "Women's 4.0 Singles, Women's 4.0 Doubles w/ Nora Fisk", ''],
    ]: f.write('\t'.join(r) + '\n')

# 7. Typo headers, event codes plus a separate level column, card ratings, age group, rating mismatch
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Sheet1'
for r in [
 ['First', 'Last', 'Gnder', 'Skill Lvl', 'Event Code', 'Parnter', 'WTN', 'UTR', 'Age Group', 'Cell'],
 ['Quinn', 'Avery', 'M', '4.5', 'MD', 'Rory Blake', '18.2', '7.25', '40+', '806-555-0201'],
 ['Rory', 'Blake', 'M', '4.0', 'MD', 'Quinn Avery', '20.1', '6.50', '40+', '806-555-0202'],
 ['Sara', 'Cho', 'F', '3.5', 'WS', '', '', '', '', ''],
 ['Uma', 'Dey', 'F', '3.5', 'XD', 'Vic Eng', '', '', '', ''],
 ['Vic', 'Eng', 'M', '3.5', 'XD', 'Uma Dey', '', '', '', ''],
]: ws.append(r)
wb.save(os.path.join(D, '07_typos_codes.xlsx'))

# 8. A plain roster: no events, no partners (should sort by sex/level and ask what event)
with open(os.path.join(D, '08_plain_roster.csv'), 'w', newline='') as f:
    csv.writer(f).writerows([['Player Name', 'Gender', 'NTRP'], ['Al Bundy', 'Male', '3.0'], ['Peg Bundy', 'Female', '3.0'], ['Kelly Bundy', 'Female', '3.5'], ['Bud Bundy', 'M', '3.5']])
# 9. Club-against-club lines (from a real director's sheet, names replaced): Division + Level (Pro/A, A1/A2 lines) + Club,
#    a team per row, many surname-only names, one "X / X" row, and one surname used in both men's and women's divisions
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Teams'
for r in [
 ["Division", "Level", "Club", "Player 1", "Player 2"],
 ["Mens", "Pro", "OHC", "Abbott", "Barlow"],
 ["Mens", "Pro", "PLC", "Ava Carver", "Ben Dunham"],
 ["Mens", "Pro/A", "OHC", "Ellery", "Barlow"],
 ["Mens", "Pro/A", "OHC", "Fenwick", "Abbott"],
 ["Mens", "Pro/A", "PLC", "Ava Carver", "Cora Garrison"],
 ["Mens", "Pro/A", "PLC", "Ben Dunham", "Dan Holloway"],
 ["Mens", "A", "OHC", "Ellery", "Ingram"],
 ["Mens", "A", "OHC", "Fenwick", "Ella Jarvis"],
 ["Mens", "A", "PLC", "Dan Holloway", "Cora Garrison"],
 ["Mens", "A", "PLC", "Finn Kessler", "Gail Kessler"],
 ["Mens", "A/B", "OHC", "Ingram", "Hank Lowry"],
 ["Mens", "A/B", "OHC", "Ella Jarvis", "Mercer"],
 ["Mens", "A/B", "PLC", "Finn Kessler", "Iris Norris"],
 ["Mens", "A/B", "PLC", "Gail Kessler", "Jack Oakley"],
 ["Mens", "B", "OHC", "Lowry", "Lowry"],
 ["Mens", "B", "OHC", "Mercer", "Pruitt"],
 ["Mens", "B", "PLC", "Jack Oakley", "Iris Norris"],
 ["Mens", "B", "PLC", "Kate Quarles", "Leo Ramsey"],
 ["Mens", "B/C", "OHC", "Sutter", "Pruitt"],
 ["Mens", "B/C", "OHC", "Mia Lowry", "Thorne"],
 ["Mens", "B/C", "PLC", "Ned Upton", "Leo Ramsey"],
 ["Mens", "B/C", "PLC", "Kate Quarles", "Opal Vance"],
 ["Mens", "C", "OHC", "Thorne", "Sutter"],
 ["Mens", "C", "PLC", "Ned Upton", "Opal Vance"],
 ["Womens", "A", "OHC", "Whitley", "Yates"],
 ["Womens", "A", "OHC", "Ashby", "Brandt"],
 ["Womens", "A", "PLC", "Pete Colby", "Rose Dorsey"],
 ["Womens", "A", "PLC", "Sam Vance", "Tess Norris"],
 ["Womens", "B", "OHC", "Easton", "Fleming"],
 ["Womens", "B", "OHC", "Granger", "Hadley"],
 ["Womens", "B", "PLC", "Vic Irwin", "Wes Jessup"],
 ["Womens", "B", "PLC", "Zoe Kirby", "Amy Upton"],
 ["Womens", "C", "OHC", "Lyman", "Sutter"],
 ["Womens", "C", "OHC", "Bo Merritt", "Nash"],
 ["Womens", "C", "PLC", "Cal Garrison", "Dee Osborne"],
 ["Womens", "C", "PLC", "Eli Pickett", "Fay Rhodes"],
 ["Mixed", "Pro/A1", "OHC", "Brandt", "Sloane"],
 ["Mixed", "Pro/A1", "OHC", "Whitley", "Barlow"],
 ["Mixed", "Pro/A1", "PLC", "Ava Carver", "Rose Dorsey"],
 ["Mixed", "Pro/A1", "PLC", "Ben Dunham", "Sam Vance"],
 ["Mixed", "A1/A2", "OHC", "Ashby", "Ingram"],
 ["Mixed", "A1/A2", "OHC", "Yates", "Fenwick"],
 ["Mixed", "A1/A2", "PLC", "Dan Holloway", "Pete Colby"],
 ["Mixed", "A1/A2", "PLC", "Cora Garrison", "Amy Upton"],
 ["Mixed", "A2/B1", "OHC", "Easton", "Ellery"],
 ["Mixed", "A2/B1", "OHC", "Fleming", "Ella Jarvis"],
 ["Mixed", "A2/B1", "PLC", "Finn Kessler", "Wes Jessup"],
 ["Mixed", "A2/B1", "PLC", "Gail Kessler", "Vic Irwin"],
 ["Mixed", "B1/B2", "OHC", "Hadley", "Hank Lowry"],
 ["Mixed", "B1/B2", "OHC", "Granger", "Pruitt"],
 ["Mixed", "B1/B2", "PLC", "Jack Oakley", "Zoe Kirby"],
 ["Mixed", "B1/B2", "PLC", "Iris Norris", "Tess Norris"],
 ["Mixed", "B2/C1", "OHC", "Bo Merritt", "Mercer"],
 ["Mixed", "B2/C1", "OHC", "Nash", "Mia Lowry"],
 ["Mixed", "B2/C1", "PLC", "Kate Quarles", "Eli Pickett"],
 ["Mixed", "B2/C1", "PLC", "Leo Ramsey", "Cal Garrison"],
 ["Mixed", "C1/C2", "OHC", "Sutter", "Thorne"],
 ["Mixed", "C1/C2", "OHC", "Lyman", "Tillman"],
 ["Mixed", "C1/C2", "PLC", "Ned Upton", "Dee Osborne"],
 ["Mixed", "C1/C2", "PLC", "Opal Vance", "Fay Rhodes"],
]: ws.append(r)
wb.save(os.path.join(D, '09_club_lines.xlsx'))
# 10. Pro-Am teams: title row, then Team | Pro | A | B | C | Pro bio, one team per row (one team missing a C player)
wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Pro-Am Teams'
for r in [
 ['Cedar Hills Pro-Am 2027', '', '', '', '', ''],
 ['Team', 'Pro', 'A Player', 'B Player', 'C Player', 'Pro Bio'],
 ['Team Cole', 'Cole Whitaker', 'Clint Barrow', 'Sloane Mathis', 'Marissa Dunn', 'Head pro at Oak Hills since 2015.'],
 ['', 'Wade Garrison', 'Luke Ashford', 'Tatum Reyes', 'Reese Calloway', ''],
 ['Net Gains', 'Grant Holloway', 'Hadley Stone', 'Brett Sandoval', 'Avery Lockhart', 'Former college No. 1.'],
 ['', 'Reid Callahan', 'Lainey Brooks', 'Tanner Pruitt', '', ''],
]: ws.append(r)
wb.save(os.path.join(D, '10_proam_teams.xlsx'))
print('ok')
