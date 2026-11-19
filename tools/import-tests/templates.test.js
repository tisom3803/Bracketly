// The in-app "Download template" files must read back cleanly through the importers.
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path'), fs = require('fs');
const X = require(process.env.XLSX_PATH || path.join(__dirname, '../../vendor/xlsx.full.min.js'));
const SI = require('../../smart-import.js');
const ld = f => { const wb = X.read(fs.readFileSync(path.join(__dirname, '../../templates', f)), {type:'buffer'}); return wb.SheetNames.map(n => ({name:n, rows:X.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:false, defval:''})})) };
test('template: sponsors', () => {
  const r = SI.sponsorList(ld('sponsors-template.xlsx')[0].rows);
  assert.equal(r.how, 'columns'); assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.sponsors.map(s => s.tier), ['title', 'gold', 'silver', 'bronze', 'friend']);
  assert.equal(r.sponsors[1].url, 'https://example.org'); assert.equal(r.sponsors[0].logo, 'example-bank.png');
});
test('template: Pro-Am teams (Section, Team, Pro, A, B, C, Flight)', () => {
  const r = SI.proAmTeams(ld('proam-teams-template.xlsx')[0].rows);
  assert.equal(r.how, 'columns'); assert.deepEqual(r.warnings, []); assert.equal(r.teams.length, 4);
  assert.deepEqual([r.teams[0].section, r.teams[0].name, r.teams[0].pro, r.teams[0].a, r.teams[0].b, r.teams[0].c, r.teams[0].flight], ["Men's", 'Team One', 'Pat Example', 'Alex Sample', 'Blake Sample', 'Casey Sample', '1']);
  assert.equal(r.teams[3].pro, ''); assert.equal(r.teams[3].flight, '2');
});
test('template: Pros (Pro, Bio)', () => {
  const r = SI.proAmTeams(ld('pros-template.xlsx')[0].rows);
  assert.equal(r.how, 'pros'); assert.equal(r.pros.length, 3); assert.equal(r.pros[0].bio, 'Head pro at Example Club since 2015.');
});
test('template: player roster', () => {
  const r = SI.run(ld('players-template.xlsx'));
  assert.equal(r.people.length, 6); assert.deepEqual(r.warnings, []);
  assert.ok(r.people.every(p => p.sex && p.rating != null));
  assert.deepEqual(r.groups.map(g => g.label).sort(), ["Men's 3.0 Singles", "Men's 3.5 Doubles", 'Mixed 8.0', "Women's 4.0 Doubles"]);
});
