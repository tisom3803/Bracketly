// v3.4 sponsor list + logo file matching. Run: node --test tools/import-tests/
const test = require('node:test'), assert = require('node:assert/strict');
const SI = require('../../smart-import.js');
const L = rows => SI.sponsorList(rows);
const pick = r => r.sponsors.map(s => [s.name, s.tier]);

test('sponsors: columns with fuzzy headers, tiers, websites, logos', () => {
  const r = L([['Sponsor Name', 'Sponsorship Level', 'Web site', 'Logo file'],
    ['Western Bank', 'Title Sponsor', 'westernbank.com', 'western-bank.png'],
    ['Plains Capital Bank', 'Platinum', 'https://www.plainscapital.com', ''],
    ['Merrill Lynch', 'Silvr', '', 'https://cdn.example.com/ml.svg'],
    ['Lee Lewis', 'bronze level', '', ''], ['DM Nutrition', 'Friends of the Event', '', ''],
    ['Odd Co', 'Emerald', 'not a url', ''], ['', '', '', ''], ['western bank', 'Gold', '', '']]);
  assert.equal(r.how, 'columns');
  assert.deepEqual(pick(r), [['Western Bank', 'title'], ['Plains Capital Bank', 'gold'], ['Merrill Lynch', 'silver'], ['Lee Lewis', 'bronze'], ['DM Nutrition', 'friend'], ['Odd Co', '']]);
  assert.equal(r.sponsors[0].url, 'https://westernbank.com');
  assert.equal(r.sponsors[0].logo, 'western-bank.png');
  assert.equal(r.sponsors[2].logo, 'https://cdn.example.com/ml.svg');
  assert.match(r.sponsors[1].tierWhy, /Gold/);
  const ts = r.warnings.map(w => w.t).sort();
  assert.deepEqual(ts, ['badUrl', 'dupe', 'unknownTier']);
});
test('sponsors: Platinum is Presenting when nothing else is', () => {
  const r = L([['Company', 'Tier'], ['Big Co', 'Platinum'], ['Mid Co', 'Gold'], ['Small Co', '4']]);
  assert.deepEqual(pick(r), [['Big Co', 'title'], ['Mid Co', 'gold'], ['Small Co', 'bronze']]);
});
test('sponsors: headings and comma lists (a flyer pasted as text)', () => {
  const r = L([['PRESENTED BY'], ['Western Bank'], ['Gold Sponsors'], ['Plains Capital Bank'], ['Silver:'], ['Merrill Lynch     Lubbock Sports Medicine     Isom Holdings'], ['Bronze'], ['Williams & Co, Aesthetic Alchemy, Lee Lewis']]);
  assert.equal(r.how, 'list');
  assert.deepEqual(pick(r), [['Western Bank', 'title'], ['Plains Capital Bank', 'gold'], ['Merrill Lynch', 'silver'], ['Lubbock Sports Medicine', 'silver'], ['Isom Holdings', 'silver'], ['Williams & Co', 'bronze'], ['Aesthetic Alchemy', 'bronze'], ['Lee Lewis', 'bronze']]);
});
test('sponsors: no tier column -> levels from amounts', () => {
  const r = L([['Business', 'Amount'], ['A Co', '$5,000'], ['B Co', '$2,500'], ['C Co', '2500'], ['D Co', '$500'], ['E Co', '']]);
  assert.deepEqual(pick(r), [['A Co', 'title'], ['B Co', 'gold'], ['C Co', 'gold'], ['D Co', 'silver'], ['E Co', '']]);
  assert.ok(r.tierNote);
});
test('sponsors: headerless rows are sniffed', () => {
  const r = L([['Western Bank', 'Presenting', 'https://westernbank.com'], ['FTNB', 'Bronze', 'ftnb.com']]);
  assert.equal(r.how, 'sniffed');
  assert.deepEqual(pick(r), [['Western Bank', 'title'], ['FTNB', 'bronze']]);
  assert.equal(r.sponsors[1].url, 'https://ftnb.com');
});
test('sponsors: tier words', () => {
  const T = v => (SI.sponsorTierRaw(v) || {}).k || '';
  for (const [v, k] of [['Title', 'title'], ['Presenting Sponsor', 'title'], ['Diamond', 'title'], ['Platinum', 'plat'], ['GOLD', 'gold'], ['Gold Level', 'gold'], ['Tier 3', 'silver'], ['3', 'silver'], ['Bronze sponsor', 'bronze'], ['Supporter', 'friend'], ['In-Kind', 'friend'], ['Presentng', 'title'], ['Emerald', '']]) assert.equal(T(v), k, v);
});
test('logos: file names match sponsors', () => {
  const names = ['Texas Tech FCU', 'Western Bank', 'First Texas National Bank', 'Lubbock Sports Medicine', 'Plains Capital Bank', 'Williams & Co'];
  const m = SI.matchLogos(['texas-tech-fcu.png', 'WesternBank_logo_FINAL.png', 'FTNB.svg', 'lsm-logo.jpg', 'random-photo.png', 'Plains-Capital.PNG', 'williams_and_co@2x.png'], names);
  assert.deepEqual(m.map(x => x.idx), [0, 1, 2, 3, -1, 4, 5]);
  const r = SI.matchLogos(['wb.png', 'promo.png'], ['Western Bank', 'Other'], {refs:['promo.png', '']});
  assert.deepEqual(r.map(x => x.idx), [-1, 0]); // the file named in the list wins over initials
  assert.equal(SI.nameFromFile('texas-tech-fcu.png'), 'Texas Tech FCU');
});

test('sponsors: inline "Level: names" labels, unknown label warns, Friends line not taken as a heading', () => {
  const r = L(SI.tablesFromText('Presented by: Western Bank\nGold Sponsors\nNew Gold Co\nEmerald: Mystery Corp\nFriends: Pat & Sam, Tiny Bakery')[0].rows);
  assert.deepEqual(r.sponsors.map(s => [s.name, s.tier]), [['Western Bank', 'title'], ['New Gold Co', 'gold'], ['Mystery Corp', ''], ['Pat & Sam', 'friend'], ['Tiny Bakery', 'friend']]);
  assert.ok(r.warnings.some(w => w.t === 'unknownTier' && /Emerald/.test(w.msg)));
});
