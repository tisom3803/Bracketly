// Run: node --test tools/import-tests/
const test = require('node:test'), assert = require('node:assert/strict');
const {load, SI} = require('./dump.js');
const R = f => SI.run(load(f));
const G = (r, label) => r.groups.find(g => g.label === label);
const names = (r, e) => e.members.map(k => r.byKey.get(k).name).sort().join(' / ');
const teams = (r, label) => { const g = G(r, label); assert.ok(g, `missing group "${label}" (have: ${r.groups.map(g => g.label).join(', ')})`); return g.entries.map(e => names(r, e)).sort() };
const person = (r, n) => r.people.find(p => p.name === n);
const warns = (r, label, n) => { const g = G(r, label); const e = g.entries.find(e => names(r, e).includes(n)); return e.warn.map(w => w.t) };

test('parsers: events', () => {
  const one = s => SI.parseEvents(s)[0];
  assert.deepEqual([one("Men's 4.0 Doubles").kind, one("Men's 4.0 Doubles").gender, one("Men's 4.0 Doubles").level], ['doubles', 'M', 4]);
  assert.deepEqual([one('WD 3.5').kind, one('WD 3.5').gender, one('WD 3.5').level], ['doubles', 'F', 3.5]);
  assert.deepEqual([one('XD 7.0').kind, one('XD 7.0').cap], ['mixed', 7]);
  assert.deepEqual([one('MS').kind, one('MS').gender], ['singles', 'M']);
  assert.equal(one('Boys 14U Singles').age, '14U');
  assert.equal(one("40+ Men's Doubles").age, '40+');
  assert.equal(one('B Singles').tier, 'b');
  assert.equal(one('Open Doubles').label, 'Open');
  assert.equal(one('Ladies 3.0').gender, 'F');
  const multi = SI.parseEvents("Women's 3.5 Singles & Doubles; Mixed 7.0 w/ Jane Doe");
  assert.equal(multi.length, 3);
  assert.deepEqual([multi[1].kind, multi[1].gender, multi[1].level], ['doubles', 'F', 3.5]);
  assert.equal(multi[2].partner, 'Jane Doe');
  assert.equal(SI.parseEvents('Jane Doe').length, 0);
});
test('parsers: names, sex, levels', () => {
  assert.equal(SI.parseName('Smith, John'), 'John Smith');
  assert.equal(SI.parseName('GARCIA, MARIA'), 'Maria Garcia');
  assert.equal(SI.parseName('Jane Doe (3.5)'), 'Jane Doe');
  assert.deepEqual(SI.splitTeam('Jane & John Doe'), ['Jane Doe', 'John Doe']);
  assert.deepEqual(SI.splitTeam('Amy Fox / Ben Carter'), ['Amy Fox', 'Ben Carter']);
  for (const [v, x] of [['Male', 'M'], ["Women's", 'F'], ['girls', 'F'], ['Boys', 'M'], ['f', 'F'], ['Mr.', 'M'], ['?', '']]) assert.equal(SI.parseSex(v), x, v);
  assert.equal(SI.parseLevel('3.5C').rating, 3.5);
  assert.equal(SI.parseLevel('NTRP 4.0').rating, 4);
  assert.equal(SI.parseLevel('3.0-3.5').rating, 3.5);
  assert.equal(SI.parseLevel('3.5+').plus, true);
  assert.equal(SI.parseLevel('B').tier, 'b');
  assert.equal(SI.parseLevel('Advanced').label, 'Advanced');
  assert.equal(SI.parseLevel('18U').age, '18U');
  assert.equal(SI.parseLevel('40 & over').age, '40+');
});
test('headers: synonyms, typos and content sniffing', () => {
  const role = h => (SI.headerRole(h) || {}).role;
  assert.equal(role('E-mail Address'), 'email');
  assert.equal(role('Gnder'), 'sex');
  assert.equal(role('Parnter'), 'partner');
  assert.equal(role('Doubles Partner'), 'partner_d');
  assert.equal(role('Mixed Doubles Partner'), 'partner_x');
  assert.equal(role('USTA #'), 'usta');
  assert.equal(role("Men's 4.0 Doubles"), 'eventcol');
  assert.equal(role('Timestamp'), '');
  // no header at all: columns read from values
  const s = SI.analyzeSheet([['Jane Doe', 'jane@x.com', 'F', '3.5'], ['John Roe', 'john@x.com', 'M', '4.0'], ['Ann Lee', 'ann@x.com', 'F', '3.0']], 'S');
  assert.deepEqual(s.cols.map(c => c.role), ['name', 'email', 'sex', 'level']);
});

test('01 Google Form: checkbox event list, doubles/mixed partner columns, TBD, partner-only', () => {
  const r = R('01_google_form.csv');
  assert.equal(r.sheets[0].cols[0].role, '');                // Timestamp ignored
  assert.deepEqual(teams(r, "Women's 3.5 Doubles"), ['Amy Fox / Beth Gale', 'Gina Lowe / Hana Moss']);
  assert.deepEqual(teams(r, "Men's 4.0 Doubles"), ['Carl Hunt / Dan Irving']);
  assert.deepEqual(teams(r, 'Mixed 8.0'), ['Amy Fox / Carl Hunt']);   // 3.5 + 4.0 -> 8.0
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['Gina Lowe / Ivan Nash']);
  assert.deepEqual(teams(r, "Men's 4.5 Singles"), ['Fred Klein']);
  assert.ok(warns(r, "Women's 3.0 Doubles", 'Erin Jones').includes('needPartner'));
  assert.ok(warns(r, "Men's 4.0 Doubles", 'Carl Hunt').includes('oneSided'));   // Dan didn't list Carl
  assert.ok(warns(r, "Women's 3.5 Doubles", 'Hana Moss').includes('partnerOnly'));
  assert.equal(person(r, 'Hana Moss').sex, 'F');                 // from the women's division
  assert.equal(r.people.length, 9);
});
test('02 title rows, Last-First names, event strings and codes, repeated rows, rating mismatch', () => {
  const r = R('02_title_rows.xlsx');
  assert.equal(r.sheets[0].hi, 3);
  assert.deepEqual(teams(r, "Men's 4.0 Doubles"), ['Bob Lee / John Smith']);
  assert.deepEqual(teams(r, "Women's 3.5 Doubles"), ['Maria Garcia / Nina Patel']);
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['John Smith / Nina Patel']);
  assert.ok(warns(r, 'Mixed 7.0', 'John').includes('rateHigh'));          // 4.0 + 3.5 > 7.0
  assert.ok(warns(r, "Women's 4.0 Singles", 'Rae Quinn').includes('rateHigh'));
  assert.equal(person(r, 'John Smith').usta, '2010123456');
  assert.equal(r.people.length, 6);                                      // John Smith once, total row skipped
});
test('03 one sheet per division: sheet name is the division, instructions sheet skipped, sex from division and mixed partner', () => {
  const r = R('03_multi_sheet.xlsx');
  assert.equal(r.use[0], false);
  assert.deepEqual(teams(r, "Men's 3.5 Doubles"), ['Tom Reed / Uri Vance', 'Will Xu / Yuri Zane']);
  assert.deepEqual(teams(r, "Women's 4.0 Doubles"), ['Ava Bell / Cara Dunn', 'Eve Ford / Gia Hart', 'Ivy Jost']);
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['Ava Bell / Tom Reed', 'Kai Lund / Mia Ness']);
  assert.equal(person(r, 'Tom Reed').sex, 'M');
  assert.equal(person(r, 'Kai Lund').sex, '');               // never guessed silently
  assert.equal(person(r, 'Mia Ness').sexGuess, 'F');          // offered as a suggestion only
  assert.ok(warns(r, 'Mixed 7.0', 'Ava Bell').includes('rateHigh'));   // 3.5 + 4.0 > 7.0
});
for (const f of ['04_checkboxes.xlsx', '04b_checkboxes.xls']) test(`${f}: checkbox columns, partner names in event columns, same email merged, repeated row`, () => {
  const r = R(f);
  assert.deepEqual(teams(r, "Men's 4.0 Doubles"), ['Paul Tran / Robert Stone']);
  assert.deepEqual(teams(r, "Women's 3.5 Doubles"), ['Kim Yates / Lisa Ward']);
  assert.deepEqual(teams(r, 'Mixed 8.0'), ['Lisa Ward / Robert Stone']);   // "Bob Stone" = Robert Stone (same email)
  assert.deepEqual(teams(r, "Men's 4.0 Singles"), ['Robert Stone']);
  assert.deepEqual(teams(r, "Women's 3.5 Singles"), ['Lisa Ward']);
  assert.equal(person(r, 'Lisa Ward').sex, 'F');                         // opposite of her mixed partner
  assert.ok(!r.people.some(p => p.name === 'Bob Stone'));
  assert.ok(warns(r, 'Mixed', 'Kim Yates').includes('needPartner'));
  assert.ok(warns(r, 'Singles', 'Sam Ochoa').includes('noSex'));
  assert.equal(r.people.length, 5);
});
test('05 no header, division title rows inside the sheet, tiers, age groups', () => {
  const r = R('05_sections.csv');
  assert.deepEqual(teams(r, "Women's 3.0 Doubles"), ['Jessica McFall / Rebekah Phillips', 'Katherine Byrne / Natalie Butler']);
  assert.deepEqual(teams(r, "Men's B Doubles"), ['Oscar Diaz / Pete Ellis', 'Quentin Fry / Raj Gupta']);
  assert.deepEqual(teams(r, 'Boys 14U Singles'), ['Sammy Hall', 'Tyler Inman']);
  assert.deepEqual(teams(r, 'Mixed 8.0'), ['Ali Hamilton / Kerry Thompson']);
  assert.equal(person(r, 'Oscar Diaz').sex, 'M');
});
test('06 pasted tab table: no sex column, several events per cell, repeated rows, w/ partner inside the cell', () => {
  const r = R('06_paste_no_sex.tsv');
  assert.deepEqual(teams(r, "Men's 3.5 Doubles"), ['Greg Adams / Hank Burns']);
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['Hank Burns / Jill Cole']);
  assert.deepEqual(teams(r, "Women's 4.0 Doubles"), ['Megan Ellis / Nora Fisk']);
  assert.deepEqual(teams(r, "Women's 4.0 Singles"), ['Megan Ellis']);
  assert.equal(person(r, 'Jill Cole').sex, 'F');      // opposite of Hank in mixed
  assert.equal(person(r, 'Taylor Dean').sex, '');     // Open Singles, name could be either: left for the director
  assert.equal(person(r, 'Taylor Dean').sexGuess, undefined);
});
test('07 typo headers, event codes + per-player levels, WTN/UTR, age group', () => {
  const r = R('07_typos_codes.xlsx');
  const role = h => r.sheets[0].cols.find(c => c.header === h).role;
  assert.equal(role('Parnter'), 'partner'); assert.equal(role('Gnder'), 'sex'); assert.equal(role('Skill Lvl'), 'level'); assert.equal(role('Cell'), 'phone');
  assert.deepEqual(teams(r, "40+ Men's 4.5 Doubles"), ['Quinn Avery / Rory Blake']);   // team level = higher player
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['Uma Dey / Vic Eng']);
  assert.deepEqual(teams(r, "Women's 3.5 Singles"), ['Sara Cho']);
  assert.equal(person(r, 'Quinn Avery').wtn_s, '18.2');
  assert.equal(person(r, 'Quinn Avery').utr, '7.25');
});
test('08 plain roster: sorted by sex and level, event left for the director', () => {
  const r = R('08_plain_roster.csv');
  assert.equal(r.groups.length, 4);
  assert.ok(r.groups.every(g => g.division.kind === null));
  const r2 = SI.run(load('08_plain_roster.csv'), {defaultKind:'singles'});
  assert.deepEqual(teams(r2, "Women's 3.5 Singles"), ['Kelly Bundy']);
  assert.deepEqual(teams(r2, "Men's 3.0 Singles"), ['Al Bundy']);
});

test('pairing: conflicts, couples sharing an email, near-duplicate names, existing roster merge', () => {
  const rows = [['Name', 'Gender', 'Rating', 'Email', 'Event', 'Partner'],
    ['Zach Mulkey', 'M', '3.5', 'mulkeys@x.com', "Men's 3.5 Doubles", 'Al Pine'],
    ['Al Pine', 'M', '3.5', '', "Men's 3.5 Doubles", 'Cy Dorn'],
    ['Cy Dorn', 'M', '3.5', '', "Men's 3.5 Doubles", 'Al Pine'],
    ['Zachary Mulkey', 'M', '3.5', '', 'Mixed 7.0', 'Dee Mulkey'],
    ['Dee Mulkey', 'F', '3.5', 'mulkeys@x.com', 'Mixed 7.0', 'Zachary Mulkey']];
  const existing = [{id:'p1', name:'Cy Dorn', rating:3.5, gender:'M'}, {id:'p2', name:'Dee Mulkey', gender:'F'}];
  const r = SI.run([{name:'S', rows}], {players:existing});
  assert.deepEqual(teams(r, "Men's 3.5 Doubles").sort(), ['Al Pine / Cy Dorn', 'Zach Mulkey']);
  assert.ok(warns(r, "Men's 3.5 Doubles", 'Zach Mulkey').includes('partnerConflict'));
  assert.ok(r.people.some(p => p.name === 'Dee Mulkey') && r.people.some(p => p.name === 'Zach Mulkey'));  // shared email, different people
  assert.ok(r.dupes.some(([a, b]) => [a, b].sort().join('|') === 'zach mulkey|zachary mulkey'));         // flagged, not merged
  assert.equal(person(r, 'Cy Dorn').existingId, 'p1');
  assert.equal(person(r, 'Dee Mulkey').existingId, 'p2');
});
test('director overrides: move an entry, set sex, choose an event for unlisted', () => {
  const t = load('03_multi_sheet.xlsx');
  const r = SI.run(t);
  const e = G(r, 'Mixed 7.0').entries.find(e => names(r, e) === 'Kai Lund / Mia Ness');
  const r2 = SI.run(t, {moves:{[e.id]:'mixed|X|c8|||'.replace('|||', '||')}, sexFix:{'kai lund':'M'}});
  assert.deepEqual(teams(r2, 'Mixed 8.0'), ['Kai Lund / Mia Ness']);
  assert.equal(person(r2, 'Kai Lund').sex, 'M');
  assert.equal(person(r2, 'Mia Ness').sex, 'F');
});
test('pasted pipes / commas / tabs and header not on line 1', () => {
  const t = SI.tablesFromText('Fall Mixer\n\n| Player | Sex | NTRP | Division |\n|---|---|---|---|\n| Ann Bay | F | 3.0 | Womens 3.0 Singles |\n| Bo Cain | M | 3.5 | Mens 3.5 Singles |\n');
  const r = SI.run(t);
  assert.deepEqual(teams(r, "Women's 3.0 Singles"), ['Ann Bay']);
  const c = SI.run(SI.tablesFromText('name,gender,level,"events"\n"Doe, Jane",F,3.5,"Singles, Doubles"\nJohn Roe,M,4.0,Singles\n'));
  assert.deepEqual(teams(c, "Women's 3.5 Singles"), ['Jane Doe']);
  assert.deepEqual(teams(c, "Women's 3.5 Doubles"), ['Jane Doe']);
});
test('scale: 400 rows parse quickly', () => {
  const rows = [['First', 'Last', 'Gender', 'NTRP', 'Events', 'Doubles Partner']];
  for (let i = 0; i < 200; i++){ rows.push(['A' + i + 'x', 'Lastname' + i, 'M', '3.5', 'Singles, Doubles', 'B' + i + 'x Lastname' + (i + 1000)]); rows.push(['B' + i + 'x', 'Lastname' + (i + 1000), 'M', '3.5', 'Doubles', 'A' + i + 'x Lastname' + i]) }
  const t0 = Date.now(), r = SI.run([{name:'Big', rows}]);
  assert.equal(teams(r, "Men's 3.5 Doubles").length, 200);
  assert.ok(Date.now() - t0 < 4000, 'took ' + (Date.now() - t0) + 'ms');
});
test('director merges two spellings into one player', () => {
  const rows = [['Name', 'Sex', 'Event', 'Partner'], ['Zach Mulkey', 'M', "Men's 3.5 Doubles", 'Al Pine'], ['Zachary Mulkey', 'M', 'Mixed 7.0', 'Dee Mulkey'], ['Al Pine', 'M', "Men's 3.5 Doubles", 'Zach Mulkey'], ['Dee Mulkey', 'F', 'Mixed 7.0', 'Zachary Mulkey']];
  const r = SI.run([{name:'S', rows}], {merge:[['zach mulkey', 'zachary mulkey']]});
  assert.equal(r.people.filter(p => /mulkey/i.test(p.name) && p.sex === 'M').length, 1);
  assert.deepEqual(teams(r, 'Mixed 7.0'), ['Dee Mulkey / Zach Mulkey']);
  assert.equal(r.dupes.length, 0);
});
