/* Bracketly smart roster import (v3.1.0)
   Pure functions, no DOM: reads messy spreadsheets / pasted tables and sorts the people into
   divisions by sex x level x singles/doubles/mixed. Used by index.html and by the Node tests in tools/import-tests.
   Nothing here writes data: the app shows the result as a preview and only saves after the director confirms. */
(function(root){
'use strict';

/* ---------- small helpers ---------- */
const S = v => v == null ? '' : String(v);
const clean = v => S(v).replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/[\u2018\u2019\u02bc`]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
const normName = n => S(n).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const normHead = h => clean(h).toLowerCase().replace(/['\u2019]s\b/g, 's').replace(/[^a-z0-9+#/]+/g, ' ').replace(/\s+/g, ' ').trim();
const round = (n, d) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
const floorHalf = n => Math.floor(n * 2 + 1e-9) / 2;
function lev(a, b){ if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length; let p = Array.from({length:b.length + 1}, (_, j) => j); for (let i = 1; i <= a.length; i++){ const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c } return p[b.length] }
const titleCase = s => s.toLowerCase().replace(/(^|[\s\-'])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase());
const fmtLv = n => { const x = Number(n); return Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? x.toFixed(1) : String(round(x, 2)) };

/* ---------- names ---------- */
const NICK = [['robert','bob','rob','bobby','robbie'],['william','bill','will','billy','liam'],['michael','mike','mikey'],['james','jim','jimmy','jamie'],['thomas','tom','tommy'],['christopher','chris'],['christine','chris','christy','tina'],['katherine','kate','katie','kathy','kat','kay'],['kathryn','kate','katie','kathy'],['catherine','cathy','cat','kate'],['elizabeth','liz','beth','lizzie','betsy','eliza','libby'],['jennifer','jen','jenny','jenn'],['matthew','matt'],['daniel','dan','danny'],['david','dave'],['joseph','joe','joey'],['steven','steve'],['stephen','steve'],['richard','rick','rich','dick','ricky'],['benjamin','ben','benji'],['samuel','sam','sammy'],['samantha','sam','sammy'],['alexander','alex','xander'],['alexandra','alex','lexi','sandra'],['nicholas','nick','nicky'],['anthony','tony'],['andrew','andy','drew'],['zachary','zach','zack'],['joshua','josh'],['jacob','jake'],['patrick','pat'],['patricia','pat','patty','trish'],['susan','sue','suzy'],['margaret','meg','peggy','maggie'],['megan','meg'],['rebecca','becky','becca'],['abigail','abby'],['allison','ally','allie'],['deborah','debbie','deb'],['edward','ed','eddie','ted'],['gregory','greg'],['jeffrey','jeff'],['jonathan','jon','jonny'],['kenneth','ken','kenny'],['lawrence','larry'],['nathan','nate'],['nathaniel','nate','nathan'],['peter','pete'],['ronald','ron','ronnie'],['timothy','tim','timmy'],['victoria','vicky','tori'],['wesley','wes'],['charles','charlie','chuck'],['frederick','fred','freddie'],['gerald','jerry'],['harold','harry','hal'],['jessica','jess','jessie'],['kimberly','kim'],['leonard','leo','len'],['madison','maddie'],['natalie','nat'],['olivia','liv'],['phillip','phil'],['philip','phil'],['raymond','ray'],['theodore','ted','teddy','theo'],['vincent','vince'],['walter','walt'],['cynthia','cindy'],['pamela','pam'],['jacqueline','jackie'],['douglas','doug'],['donald','don'],['randall','randy'],['bradley','brad'],['cameron','cam'],['mitchell','mitch'],['gabriel','gabe'],['gabrielle','gabby'],['caroline','carrie'],['emily','em'],['amanda','mandy'],['melissa','missy','mel'],['valerie','val'],['frances','fran'],['francis','frank'],['franklin','frank'],['johnathan','jon','john']];
const NICKMAP = new Map(); NICK.forEach(g => g.forEach(n => { const s = NICKMAP.get(n) || new Set(); g.forEach(x => s.add(x)); NICKMAP.set(n, s) }));
const sameFirst = (a, b) => a === b || (NICKMAP.get(a) && NICKMAP.get(a).has(b)) || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));

// Low-confidence first-name hints. Only ever shown as a suggestion the director confirms.
const FN_M = 'aaron adam adrian alan albert alex alexander andrew andy anthony austin ben benjamin bill billy blake bob bobby brad bradley brandon brendan brent brett brian bruce bryan caleb cameron carl carlos chad charles charlie chase chris christopher cody colby cole colin connor craig curtis dale dan daniel danny darren dave david dean derek dennis dillon don donald doug douglas drew dustin dylan ed eddie edward eli eric ethan evan frank fred gabe gabriel gary gavin george grant greg gregory hank harry hayden henry hunter ian isaac jack jackson jacob jake james jared jason jeff jeffrey jeremy jerry jesse jim jimmy joe joel john johnny jon jonathan jordan jose joseph josh joshua juan justin keith ken kenneth kevin kyle lance landon larry lee liam logan louis lucas luke marcus mark martin mason matt matthew max michael mike mitch nate nathan neil nick nicholas noah owen patrick paul pete peter phil philip randy ray raymond ricardo richard rick ricky rob robert rod roger ron ronald ross russell ryan sam samuel scott sean seth shane shawn spencer stephen steve steven ted terry thomas tim timothy todd tom tommy tony travis trent trevor troy tyler victor vince walter wade wayne wes wesley will william zach zachary'.split(' ');
const FN_F = 'abby abigail addison alexa alexandra alexis alice alicia alison allison alyssa amanda amber amy andrea angela angie ann anna anne annie april ashley audrey ava barbara beth bethany betty brenda brianna bridget brittany brooke caitlin camille candace carla carol caroline carolyn carrie cassidy catherine cathy charlotte chelsea cheryl christina christine cindy claire courtney crystal cynthia dana danielle dawn debbie deborah denise diana diane donna elaine elena elizabeth ella ellen emily emma erica erin eva evelyn faith gabriella gina grace gretchen hailey haley hannah heather heidi holly hope isabel isabella jackie jacqueline jamie jane janet janice jasmine jean jenna jennifer jenny jessica jill joan joanna jocelyn jodi josephine joy joyce judy julia julie kaci kaitlyn karen kari kate katelyn katherine kathleen kathryn kathy katie kayla kelli kelly kelsey kendra kerry kim kimberly kristen kristin kristy krista laura lauren leah leslie lily linda lindsay lindsey lisa liz lori lucy lydia lynn madison mallory mandy margaret maria marie marilyn martha mary megan melanie melissa meredith mia michelle mindy molly monica morgan nancy natalie nicole olivia paige pam pamela patricia paula peggy rachel rebecca rebekah renee rhonda robin rose ruth sabrina sally samantha sandra sara sarah savannah shannon sharon shelby shelly sherry sophia stacy stephanie sue susan sydney tamara tammy tara taylor teresa tiffany tina tracy valerie vanessa veronica vicki victoria wendy whitney'.split(' ');
const FN = new Map([...FN_M.map(n => [n, 'M']), ...FN_F.map(n => [n, 'F'])]);
['taylor','jordan','jamie','morgan','kerry','robin','lee','dana','casey','terry','sam','alex','chris','pat','kelly','lynn'].forEach(n => FN.set(n, ''));   // could be either
function guessSexFromFirst(first){ return FN.get(normName(first).split(' ')[0]) || '' }

const BAD_NAME = /^(total|totals|count|name|names|player|players|participant|team|teams|n\/?a|none|tbd|tba|bye|-+|\?+|x|blank|sample|example|first|last|first name|last name|email|phone|grand total|subtotal)$/i;
const NEED_PARTNER = /^(tbd|tba|need(s)?( a)? partner|looking( for( a)?( partner)?)?|none|no partner|n\/?a|\?+|-+|any|anyone|find me one|please (find|assign)|assign|pick for me|unknown|open|x)$/i;
/* "Smith, Jane" -> Jane Smith; "SMITH, JANE" -> Jane Smith; trims ratings in brackets */
function parseName(v){
  let s = clean(v).replace(/\s*\((?:[^)]*)\)\s*/g, ' ').replace(/\s+-\s+\d(?:\.\d+)?\s*[a-z]?$/i, '').replace(/\s+\d\.\d\s*[a-z]?$/i, '').replace(/^[\d]+[.)]\s+/, '').replace(/\*+/g, '').trim();
  if (!s) return '';
  const m = s.match(/^([A-Za-z'\-\u00c0-\u024f]+(?: (?:jr|sr|ii|iii|iv)\.?)?)\s*,\s*([A-Za-z'\-.\u00c0-\u024f]+(?: [A-Za-z'\-.\u00c0-\u024f]+)?)$/i);
  if (m && !/\s/.test(m[1].replace(/ (jr|sr|ii|iii|iv)\.?$/i, ''))) s = m[2] + ' ' + m[1];
  if (s === s.toUpperCase() && /[A-Z]{2}/.test(s)) s = titleCase(s);
  if (s === s.toLowerCase() && /[a-z]{2}/.test(s)) s = titleCase(s);
  return s.replace(/\s+/g, ' ').trim();
}
const nameLike = v => { const s = clean(v); return s.length >= 2 && s.length <= 60 && /[a-z]/i.test(s) && !/@|https?:|\d{3}/.test(s) && !/^\d/.test(s) && s.split(/\s+/).length <= 6 };
const fullNameLike = v => nameLike(v) && (/\S\s+\S/.test(clean(v)) || /^[a-z'\-]+\s*,\s*[a-z'\-]+/i.test(clean(v)));
/* split "Jane Doe / John Doe", "Jane & John Doe" -> two names */
function splitTeam(v){
  const s = clean(v); if (!s) return [];
  let parts = s.split(/\s*\/\s*|\s+&\s+|\s+and\s+|\s*\+\s*|\s*;\s*/i).map(x => x.trim()).filter(Boolean);
  if (parts.length < 2){
    const c = s.split(/\s*,\s*/); if (c.length === 2 && c.every(x => /\s/.test(x.trim()))) parts = c;   // "Jane Doe, John Doe"
  }
  if (parts.length === 2 && !/\s/.test(parts[0]) && /\s/.test(parts[1])) parts[0] = parts[0] + ' ' + parts[1].split(/\s+/).slice(1).join(' ');   // "Jane & John Doe"
  return parts;
}

/* ---------- values ---------- */
function parseSex(v){
  const s = clean(v).toLowerCase().replace(/[.']/g, '').trim();
  if (!s) return '';
  if (/^(m|male|man|men|mens|boy|boys|gentleman|gentlemen|mr|he|him|he\/him|guy)$/.test(s)) return 'M';
  if (/^(f|w|female|woman|women|womens|lady|ladies|girl|girls|mrs|ms|miss|she|her|she\/her)$/.test(s)) return 'F';
  return '';
}
const TIERS = {pro:'pro', p:'pro', professional:'pro', 'teaching pro':'pro', a:'a', b:'b', c:'c', d:'d'};
const SKILL = [['open', 'Open'], ['championship', 'Championship'], ['advanced', 'Advanced'], ['adv', 'Advanced'], ['intermediate', 'Intermediate'], ['int', 'Intermediate'], ['beginner', 'Beginner'], ['beg', 'Beginner'], ['novice', 'Novice'], ['recreational', 'Recreational'], ['rec', 'Recreational'], ['competitive', 'Competitive']];
/* One level cell: NTRP / DUPR number, A/B/C/Pro tier, a skill word, or an age group.
   -> {rating, tier, label, age, plus} (only the parts found) */
function parseLevel(v, opts){
  opts = opts || {};
  let s = clean(v).toLowerCase().replace(/\b(ntrp|usta|dupr|rating|level|lvl|self[- ]?rated?|computer|c-rated)\b/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return {};
  const out = {};
  const age = s.match(/\b(\d{1,2})\s*(?:u|&\s*under|and under|under)\b/) || s.match(/\b(?:u|under)\s*(\d{1,2})\b/);
  if (age){ out.age = age[1] + 'U'; s = s.replace(age[0], ' ') }
  const over = s.match(/\b([2-8]\d)\s*(?:\+|&\s*over|and over|s\b|over)/) || s.match(/\b(?:over|senior)\s*([2-8]\d)\b/);
  if (over){ out.age = over[1] + '+'; s = s.replace(over[0], ' ') }
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return out;
  if (/^(pro|professional|teaching pro|tour)$/.test(s)) return Object.assign(out, {tier:'pro'});
  let m = s.match(/^(?:flight |level |class |group |division |div |grade )?([abcd])(?: (?:flight|player|level|division|div|grade|group))?$/);
  if (m) return Object.assign(out, {tier:m[1]});
  for (const [w, l] of SKILL) if (new RegExp('^' + w + '\\b').test(s) && !/\d/.test(s)) return Object.assign(out, {label:l});
  // ranges like 3.0-3.5 take the top; "3.5+" means 3.5 and up
  m = s.match(/(\d{1,2}(?:[.,]\d{1,3})?)\s*(?:-|to)\s*(\d{1,2}(?:[.,]\d{1,3})?)/);
  let num = m ? m[2] : (s.match(/(\d{1,2}(?:[.,]\d{1,3})?)/) || [])[1];
  if (num == null) return out;
  const n = parseFloat(num.replace(',', '.'));
  if (!isFinite(n) || n <= 0) return out;
  const max = opts.max || 10;
  if (n > max) return out;
  out.rating = round(n, 3);
  if (/\+/.test(s)) out.plus = true;
  const t = s.match(/\d(?:\.\d)?\s*([csatmd])\b/); if (t) out.ntrpType = t[1].toUpperCase();
  return out;
}
const TRUTHY = /^(x|y|yes|yep|true|1|✓|✔|☑|✅|checked|in|entered|selected|on|t|playing|registered|ok|\*)$/i;
const FALSY = /^(n|no|false|0|-+|none|n\/?a|not playing|off|f|no thanks|declined|skip|nope)$/i;

/* ---------- events ---------- */
/* "Men's 4.0 Doubles", "WD 3.5", "XD 7.0", "Mixed 8.0", "40+ Men's Doubles", "Boys 14U Singles", "B Singles"
   -> {kind:'singles'|'doubles'|'mixed'|null, gender:'M'|'F'|'', level, cap, tier, label, age, partner} or null */
function parseEventItem(v){
  let raw = clean(v); if (!raw) return null;
  let partner = null;
  const pm = raw.match(/\s*(?:\bw\/\s*|\bwith\s+|\bpartner(?:ed)?(?: with)?\s*[:\-]?\s+|\bp:\s*|\(\s*(?:w\/|with|partner[:\s])\s*)([A-Za-z][A-Za-z'.\-]+(?:\s+[A-Za-z'.\-]+){0,3})\s*\)?\s*$/i);
  if (pm){ partner = pm[1].trim(); raw = raw.slice(0, pm.index).trim() }
  let s = ' ' + raw.toLowerCase().replace(/[’']/g, '').replace(/[_|]/g, ' ').replace(/\b(division|div|event|draw|bracket|category|entries|entry|tournament|flight|draws|events|ntrp|usta|level|dupr)\b/g, ' ').replace(/\s+/g, ' ') + ' ';
  const t = {kind:null, gender:'', level:null, cap:null, tier:'', label:'', age:'', raw:clean(v)};
  // codes: MS MD WS WD XD MX BS BD GS GD LS LD
  const code = s.match(/\s(m|w|x|b|g|l|mx)([sd])(?=[\s\d.\-]|$)/) || s.match(/\s(mxd|xd|mx)(?=[\s\d.\-]|$)/);
  if (code){
    const c = code[1];
    if (c === 'mxd' || c === 'xd' || c === 'mx') t.kind = 'mixed';
    else { t.kind = code[2] === 's' ? 'singles' : 'doubles'; if (c === 'x') t.kind = 'mixed'; t.gender = /^[mb]$/.test(c) ? 'M' : /^[wgl]$/.test(c) ? 'F' : '' }
    s = s.replace(code[0], ' ');
  }
  if (/\b(mixed|mxd|mix)\b/.test(s)) t.kind = 'mixed';
  else if (/\b(singles?|sgls?|sngls?)\b/.test(s)) t.kind = t.kind || 'singles';
  else if (/\b(doubles?|dbls?|dubs)\b/.test(s)) t.kind = t.kind || 'doubles';
  if (!t.gender && t.kind !== 'mixed'){
    if (/\b(women|womens|woman|ladies|lady|female|females|girls|girl|w)\b/.test(s)) t.gender = 'F';
    else if (/\b(men|mens|man|male|males|boys|boy|gentlemen|gents|m)\b/.test(s)) t.gender = 'M';
  }
  if (/\b(boys|girls|junior|juniors)\b/.test(s)) t.junior = true;
  const lv = parseLevel(s.replace(/\b(mixed|mxd|mix|singles?|sgls?|doubles?|dbls?|dubs|women|womens|woman|ladies|lady|female|females|girls|girl|men|mens|man|male|males|boys|boy|gentlemen|gents|junior|juniors|combined|combo|open)\b/g, ' ').replace(/\s[mwfx]\s/g, ' '), {max:20});
  if (lv.age) t.age = lv.age;
  if (lv.tier) t.tier = lv.tier;
  if (lv.label) t.label = lv.label;
  if (/\bopen\b/.test(s) && !lv.rating && !lv.tier) t.label = t.label || 'Open';
  if (lv.rating != null){
    if (lv.rating >= 1 && lv.rating <= 7.5 && t.kind !== 'mixed' && !/\b(combined|combo)\b/.test(s)) t.level = lv.rating;
    else if (lv.rating >= 4 && lv.rating <= 16) { t.cap = lv.rating; if (t.kind !== 'mixed' && !t.kind) t.kind = t.gender ? 'doubles' : 'mixed' }
    else if (t.kind === 'mixed' && lv.rating <= 7.5) t.cap = lv.rating;
    if (lv.plus) t.plus = true;
  }
  if (!t.kind && !t.gender && t.level == null && t.cap == null && !t.tier && !t.label && !t.age) return null;
  // Lone words that are really something else ("A", "M") don't count as an event on their own
  if (!t.kind && t.level == null && t.cap == null && !t.age && !t.label && raw.length <= 2) return null;
  if (partner) t.partner = partner;
  return t;
}
/* A cell with several events: "Men's 4.0 Singles, Doubles; Mixed 8.0 w/ Jane Doe" */
function parseEvents(v){
  const s = clean(v).replace(/\bw\/\s*/gi, 'with '); if (!s) return [];
  const items = s.split(/\s*(?:[,;|\n]|\s\+\s|\/(?![a-z]{1,2}\b)|\s&\s|\sand\s)\s*/i).filter(Boolean);
  const out = []; let prev = null;
  // "with Jane Doe" may have been cut by a comma: glue name-only items back to the previous event as its partner
  for (const it of items){
    const e = parseEventItem(it);
    if (!e){ if (prev && !prev.partner && fullNameLike(it) && !/single/.test(prev.kind || '')) prev.partner = it.replace(/^(w\/|with)\s*/i, '').trim(); continue }
    if (prev){ if (!e.gender && e.kind !== 'mixed' && prev.kind !== 'mixed') e.gender = prev.gender; if (e.level == null && e.cap == null && e.kind !== 'mixed' && prev.level != null && !e.tier && !e.label) e.level = prev.level; if (!e.age && prev.age) e.age = prev.age }
    out.push(e); prev = e;
  }
  return out;
}
function eventLabel(d, sport){
  const g = d.gender === 'M' ? (d.junior ? 'Boys' : "Men's") : d.gender === 'F' ? (d.junior ? 'Girls' : "Women's") : '';
  const lv = d.cap != null ? fmtLv(d.cap) : d.level != null ? fmtLv(d.level) + (d.plus ? '+' : '') : d.tier ? (d.tier === 'pro' ? 'Pro' : d.tier.toUpperCase()) : d.label || '';
  const age = d.age || '';
  if (d.kind === 'mixed') return ['Mixed', age, lv, 'Doubles'].filter(Boolean).join(' ').replace(/ Doubles$/, '');
  if (d.kind === 'singles') return [age && /\+/.test(age) ? age : '', g, age && /U$/.test(age) ? age : '', lv, 'Singles'].filter(Boolean).join(' ');
  if (d.kind === 'doubles') return [age && /\+/.test(age) ? age : '', g || (lv || age ? '' : 'Open'), age && /U$/.test(age) ? age : '', lv || (g ? '' : ''), 'Doubles'].filter(Boolean).join(' ');
  return [age && /\+/.test(age) ? age : '', g, age && /U$/.test(age) ? age : '', lv, '· event not listed'].filter(Boolean).join(' ');
}
const groupKey = d => [d.kind || '?', d.kind === 'mixed' ? 'X' : (d.gender || ''), d.cap != null ? 'c' + fmtLv(d.cap) : d.level != null ? fmtLv(d.level) + (d.plus ? '+' : '') : d.tier ? 't' + d.tier : d.label ? 'l' + d.label.toLowerCase() : '', d.age || '', d.junior ? 'j' : ''].join('|');
function parseGroupKey(k){ const [kind, gender, lv, age, j] = k.split('|'); const d = {kind:kind === '?' ? null : kind, gender:gender === 'X' ? '' : gender, level:null, cap:null, tier:'', label:'', age:age || '', junior:j === 'j'}; if (/^c/.test(lv)) d.cap = parseFloat(lv.slice(1)); else if (/^t/.test(lv)) d.tier = lv.slice(1); else if (/^l/.test(lv)) d.label = lv.slice(1).replace(/^./, c => c.toUpperCase()); else if (lv){ d.level = parseFloat(lv); d.plus = /\+$/.test(lv) } return d }

/* ---------- columns ---------- */
const ROLES = [
  ['', 'Ignore'], ['name', 'Full name'], ['first', 'First name'], ['last', 'Last name'], ['sex', 'Sex (M/F)'], ['level', 'Level / rating'],
  ['event', 'Event(s) / division'], ['eventcol', 'Entered in this event (column header is the event)'], ['agegrp', 'Age group'],
  ['partner', 'Partner'], ['partner_d', 'Doubles partner'], ['partner_x', 'Mixed partner'], ['p2first', 'Partner first name'], ['p2last', 'Partner last name'],
  ['p2level', 'Partner level / rating'], ['p2sex', 'Partner sex'], ['p2email', 'Partner email'], ['p2phone', 'Partner phone'], ['p2usta', 'Partner USTA #'], ['teamrating', 'Team rating'],
  ['email', 'Email'], ['phone', 'Phone'], ['usta', 'USTA #'], ['ntrp', 'NTRP'], ['wtn_s', 'WTN singles'], ['wtn_d', 'WTN doubles'], ['utr', 'UTR'], ['club', 'Club / team']
];
const P2 = '(?:partner|partners|player 2|player two|p2|teammate|team mate|second player|2nd player|doubles partner|mixed partner|partner 1)';
const HEAD = [
  ['p2first', new RegExp('^' + P2 + 's? (first|first name|fname|given name)$')], ['p2last', new RegExp('^' + P2 + 's? (last|last name|lname|surname)$')],
  ['p2email', new RegExp(P2 + '.*e ?mail')], ['p2phone', new RegExp(P2 + '.*(phone|cell|mobile)')], ['p2usta', new RegExp(P2 + '.*usta')],
  ['p2level', new RegExp(P2 + '.*(rating|ntrp|level|dupr|skill|utr)|(rating|ntrp|level|dupr) (of )?' + P2)], ['p2sex', new RegExp(P2 + '.*(gender|sex|m/f)')],
  ['partner_x', /^(mixed|mixed doubles|mxd|xd) ?partner( name| s name| full name)?$|^partner (for )?(mixed|mxd|xd)( doubles)?$|^mixed doubles partner|^mixed partner/],
  ['partner_d', /^(doubles|dbls|mens doubles|womens doubles|ladies doubles|md|wd) ?partner( name| s name| full name)?$|^partner (for )?(doubles|dbls)$|^doubles partner/],
  ['partner', new RegExp('^' + P2 + '( name| s name| full name)?$|^(partner|partners|partner name|partners name)\\b|^with$|^partnering with$')],
  ['teamrating', /(team|combined|pair|total) (rating|ntrp|level|dupr)|^(team|combined) (rating|total)$/],
  ['first', /^(first|first name|fname|f name|given name|forename|player first name|player 1 first name|player 1 first|player first|first nm|name first)$/],
  ['last', /^(last|last name|lname|l name|surname|family name|player last name|player 1 last name|player 1 last|player last|last nm|name last)$/],
  ['name', /^(name|names|full name|player|players|player name|players name|participant|participant name|player 1|player one|p1|player 1 name|entrant|entrant name|competitor|athlete|member|member name|registrant|registrant name|your name|player full name|team|team name|pair|doubles team|team members|entry|man|men|male|gentleman|woman|women|female|lady|ladies)$/],
  ['usta', /^usta ?(#|no|num|number|id|member|membership|account)?( ?(#|no|number|id))?$|^usta member(ship)? (#|no|number|id)|^usta$|^member (#|no|number|id)$/], ['ntrp', /^(ntrp|ntrp rating|ntrp level|usta ntrp|usta rating|computer rating|year end rating|current ntrp|\d{4} ntrp|ntrp \d{4})$/],
  ['wtn_d', /^wtn ?(doubles|dbls|d)$|^(doubles|dbls) wtn$|^wtn \(?doubles\)?$/], ['wtn_s', /^wtn( ?(singles|sgls|s))?$|^(singles|sgls) wtn$/], ['utr', /^utr( rating| singles| doubles)?$/],
  ['agegrp', /^(age group|age division|age bracket|age category|age class|age)$/],
  ['sex', /^(gender|sex|m ?\/ ?f|m or f|male ?\/ ?female|gender m ?\/ ?f|sex m ?\/ ?f|g|mf|men ?\/ ?women|boys ?\/ ?girls)$|\b(gender|sex)\b/],
  ['level', /^(rating|ratings|level|levels|skill|skill level|ability|ability level|playing level|self rating|self rated|rating level|class|tier|grade|division level|level rating|dupr|dupr rating|player rating|rtg|lvl|flight)$|\b(rating|level|skill)\b/],
  ['email', /e ?mail/], ['phone', /phone|cell|mobile|^tel|telephone|contact number|text/],
  ['club', /^(club|home club|facility|team|organization|org|academy|school|section|district|city|home court|club name|team name|affiliation|town)$/],
  ['event', /^(event|events|division|divisions|bracket|brackets|category|categories|draw|draws|events entered|event entered|event 1|event 2|event 3|event 4|1st event|2nd event|3rd event|first event|second event|third event|competition|entry|entries|events selected|which events|event s|events playing|division s|event choice|event selection|playing in|events? \/ divisions?)$|\b(events?|divisions?)\b/],
  ['', /^(timestamp|date|submitted|submitted at|time|paid|payment|amount|fee|fees|total paid|price|notes?|comments?|shirt|shirt size|t ?shirt|size|waiver|dob|birth ?date|date of birth|birthday|address|street|zip|zip code|postal|state|country|#|no|id|row|seq|order|check ?in|checked in|status|confirmation|conflicts?|availability|requests?|seed|ranking|rank|venmo|cash|paypal)$|\b(shirt|size|paid|payment|waiver|timestamp|birth|dob|address|notes?|comments?|fee|venmo|zip)\b/]
];
const EV_HEAD = /(single|double|mixed|\bmx\b|\bxd\b|\b[mwbg][sd]\b|dbls|sgls)/;
const FUZZ_WORDS = [['name', 'name'], ['first', 'first'], ['last', 'last'], ['gender', 'sex'], ['partner', 'partner'], ['rating', 'level'], ['level', 'level'], ['email', 'email'], ['phone', 'phone'], ['event', 'event'], ['division', 'event'], ['singles', 'eventcol'], ['doubles', 'eventcol'], ['mixed', 'eventcol']];
function headerRole(h){
  const n = normHead(h).replace(/#/g, ' #').replace(/\s+/g, ' ').trim(), n2 = n.replace(/\s*#\s*/g, ' ').trim();
  if (!n) return null;
  // the header itself names an event: "Singles", "Men's 4.0 Doubles", "Mixed partner" is handled above
  for (const [role, re] of HEAD){
    if (role === 'event' || role === 'level') continue;
    if (re.test(n) || re.test(n2)) return {role, conf:/^\^/.test(re.source) && (re.source.includes('^(' + n2 + ')') || new RegExp('^(?:' + re.source.replace(/^\^/, '') + ')$').test(n2)) ? .95 : .85, why:`header "${clean(h)}"`};
  }
  if (EV_HEAD.test(n) && !/partner/.test(n)){ const e = parseEventItem(h); if (e && e.kind) return {role:'eventcol', conf:.85, why:`header "${clean(h)}" names an event`, ev:e} }
  for (const [role, re] of HEAD) if ((role === 'event' || role === 'level') && (re.test(n) || re.test(n2))) return {role, conf:.9, why:`header "${clean(h)}"`};
  // typos: "Gnder", "Parnter", "Raiting"
  for (const w of n2.split(' ')) if (w.length >= 4) for (const [k, role] of FUZZ_WORDS){ if (lev(w, k) <= (k.length >= 6 ? 2 : 1) && w !== k){ if (role === 'eventcol'){ const e = parseEventItem(k); return {role, conf:.6, why:`header "${clean(h)}" (looks like ${k})`, ev:e} } return {role, conf:.6, why:`header "${clean(h)}" (looks like "${k}")`} } }
  return null;
}
/* What a column holds, from its values */
function sniff(vals, header){
  const v = vals.map(clean).filter(Boolean); const n = v.length;
  if (!n) return {role:'', conf:.3, why:'empty column'};
  const fr = t => v.filter(t).length / n, uniq = new Set(v.map(x => x.toLowerCase())).size;
  const r = [];
  r.push(['email', fr(x => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(x)), 'looks like emails']);
  r.push(['phone', fr(x => /^\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/.test(x) && /[\s.\-()]/.test(x)), 'looks like phone numbers']);
  r.push(['usta', fr(x => /^\d{9,11}$/.test(x.replace(/\s/g, ''))) * .8, 'looks like USTA numbers']);
  r.push(['sex', fr(x => !!parseSex(x)) * (uniq <= 6 ? 1 : .5), 'values are M / F']);
  const ntrp = fr(x => { const l = parseLevel(x); return l.rating != null && l.rating >= 1 && l.rating <= 7 && /^\s*(ntrp\s*)?\d(\.\d{1,2})?\s*[csatmd]?\s*(\+|ntrp)?\s*$/i.test(x) || !!l.tier || !!l.label });
  r.push(['level', ntrp, 'values are levels like 3.5 / A / B']);
  const evs = fr(x => { const e = parseEvents(x); return e.length && e.some(z => z.kind || (z.gender && (z.level != null || z.tier || z.cap != null))) });
  r.push(['event', evs, 'values are events like "Men\'s 4.0 Doubles"']);
  const flag = fr(x => TRUTHY.test(x) || FALSY.test(x));
  if (header && EV_HEAD.test(normHead(header))) r.push(['eventcol', Math.max(flag, fr(x => TRUTHY.test(x) || FALSY.test(x) || nameLike(x) || parseLevel(x).rating != null)) * .95, 'column of check marks / partners for this event']);
  r.push(['name', fr(fullNameLike) * (uniq / n > .6 ? 1 : .6), 'values are full names']);
  r.push(['first', fr(x => nameLike(x) && !/\s/.test(x)) * (fr(x => FN.has(normName(x))) > .4 ? .8 : .45), 'single first names']);
  r.push(['last', fr(x => nameLike(x) && !/\s/.test(x)) * .4, 'single words (surnames?)']);
  r.push(['agegrp', fr(x => /^\d{1,2}\s*(u|\+|& ?(under|over))$/i.test(x)), 'age groups']);
  const ts = fr(x => /^\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}/.test(x) || /^\$/.test(x));
  if (ts > .6) return {role:'', conf:.8, why:'dates or money'};
  r.sort((a, b) => b[1] - a[1]);
  const [role, sc, why] = r[0];
  return sc >= .55 ? {role, conf:Math.min(.9, sc * .9), why} : {role:'', conf:.3, why:'nothing recognised'};
}
const PEOPLE_ROLES = new Set(['name', 'first', 'last']);
/* Which row is the header: the first rows may be a title, a date, blank, etc. */
function findHeader(rows){
  let best = {i:-1, score:0};
  for (let i = 0; i < Math.min(rows.length, 25); i++){
    const r = rows[i], cells = r.map(clean).filter(Boolean); if (cells.length < 1) continue;
    let score = 0, people = false;
    r.forEach(c => { const h = headerRole(c); if (h){ score += h.conf; if (PEOPLE_ROLES.has(h.role) || /partner/.test(h.role)) people = true } });
    if (cells.some(c => /@|^\d{3}.*\d{4}$/.test(c) || fullNameLike(c) && !headerRole(c))) score -= .8;
    if (cells.length === 1) score -= .5;
    if (people) score += 1;
    if (score > best.score + .01) best = {i, score};
  }
  return best.score >= 1.6 ? best.i : -1;
}
/* A row that is just a division title ("Women's 3.5" / "MEN'S DOUBLES 4.0") inside the data */
function sectionOf(row, colsUsed){
  const cells = row.map(clean).filter(Boolean);
  if (cells.length !== 1 && !(cells.length === 2 && /^\(?\d+\s*(teams?|players?|entries)?\)?$/i.test(cells[1]))) return null;
  const c = cells[0]; if (c.length > 60 || /\s\/\s|\s&\s/.test(c)) return null;
  const e = parseEvents(c.replace(/[:\-]+$/, '').replace(/\(.*?\)/g, ''));
  if (!e.length || !e.some(x => x.kind || x.gender || x.level != null || x.cap != null || x.age || x.tier)) return null;
  if (fullNameLike(c) && !e.some(x => x.kind || x.level != null || x.cap != null || x.tier || x.age)) return null;
  return e[0];
}

function analyzeSheet(rows0, sheetName, opts){
  opts = opts || {};
  const rows = (rows0 || []).map(r => (Array.isArray(r) ? r : [r]).map(c => clean(c)));
  const width = Math.max(0, ...rows.map(r => r.length));
  rows.forEach(r => { while (r.length < width) r.push('') });
  let hi = opts.hi != null && opts.hi >= -1 && opts.hi < rows.length ? opts.hi : findHeader(rows);
  const titles = rows.slice(0, hi < 0 ? 0 : hi).map(r => r.filter(Boolean).join(' ')).filter(Boolean);
  const ctx = [sheetName, ...titles].map(t => /^(sheet|tab|page|table)\s*\d*$/i.test(clean(t)) ? null : parseEvents(t)[0]).filter(e => e && (e.kind || e.gender)).reduce((a, e) => Object.assign(a, Object.fromEntries(Object.entries(e).filter(([k, v]) => v != null && v !== '' && k !== 'raw' && k !== 'partner'))), {});
  const header = hi >= 0 ? rows[hi] : rows[0] ? rows[0].map((_, i) => '') : [];
  const data = rows.slice(hi + 1).filter(r => r.some(Boolean) && !sectionOf(r) && !(hi >= 0 && r.join('|').toLowerCase() === rows[hi].join('|').toLowerCase()));
  const cols = [];
  for (let i = 0; i < width; i++){
    const vals = data.slice(0, 400).map(r => r[i]);
    const h = hi >= 0 && header[i] ? headerRole(header[i]) : null, sn = sniff(vals, header[i]);
    let pick;
    if (h){
      pick = Object.assign({}, h);
      if (sn.role && sn.role === h.role) pick.conf = Math.max(h.conf, .97);
      else if (h.role === '' ) pick = h;
      else if (sn.conf >= .75 && ['email', 'phone'].includes(sn.role) && !['email', 'phone', 'p2email', 'p2phone'].includes(h.role)) pick = Object.assign({}, sn, {why:sn.why + ` (header says "${clean(header[i])}")`});
      else if (/^(partner|p2)/.test(h.role) && ['name', 'first', 'last'].includes(sn.role)) pick = Object.assign({}, h, {conf:Math.max(h.conf, .8)});
      else if (h.role === 'name' && sn.role === 'first' && /^(name|player|first)$/i.test(normHead(header[i]))) pick = Object.assign({}, h, {conf:.7});
      else if (['level', 'event'].includes(h.role) && ['level', 'event', 'eventcol'].includes(sn.role) && sn.conf > .7) pick = Object.assign({}, sn.role === 'eventcol' ? h : sn, {why:h.why + ', ' + sn.why});
      else if (h.role === 'club' && sn.role === 'name' && /team/.test(normHead(header[i]))) pick = Object.assign({}, sn, {role:'name', why:'team names'});
      else if (sn.role && sn.conf >= .6 && h.conf < .8) pick = Object.assign({}, sn);
    } else pick = Object.assign({}, sn);
    if (pick.role === 'eventcol' && !pick.ev) pick.ev = parseEventItem(header[i]) || null;
    const samples = vals.filter(Boolean).slice(0, 3);
    cols.push({i, header:header[i] || '', role:pick.role || '', conf:round(pick.conf || 0, 2), why:pick.why || '', samples, ev:pick.ev || null});
  }
  // tidy up: one of each single-use role; second full-name column is the partner; two single-word columns are first + last
  const seen = new Map();
  cols.forEach(c => {
    if (!c.role || ['event', 'eventcol', ''].includes(c.role)) return;
    if (seen.has(c.role)){
      const prev = seen.get(c.role);
      if (c.role === 'name' && !cols.some(x => /^partner/.test(x.role))){ c.role = 'partner'; c.why += ' (second name column, read as the partner)'; c.conf = Math.min(c.conf, .7) }
      else if (c.role === 'first' && !cols.some(x => x.role === 'last')){ c.role = 'last'; c.conf = .6 }
      else if (c.role === 'level' && prev.role === 'level' && cols.some(x => /^partner/.test(x.role) && x.i < c.i)){ c.role = 'p2level'; c.why += ' (after the partner, read as partner level)' }
      else if (c.role === 'sex' && cols.some(x => /^partner/.test(x.role) && x.i < c.i)){ c.role = 'p2sex'; c.why += ' (after the partner)' }
      else if (c.role === 'email' && cols.some(x => /^partner/.test(x.role) && x.i < c.i)){ c.role = 'p2email' }
      else if (c.role === 'phone' && cols.some(x => /^partner/.test(x.role) && x.i < c.i)){ c.role = 'p2phone' }
      else if (c.role === 'level'){ /* two level columns (e.g. NTRP + self rating): keep the first */ c.role = ''; c.why = 'another level column (ignored)'; c.conf = .4 }
      else if (!['first', 'last'].includes(c.role) || !cols.some(x => x.role === (c.role === 'first' ? 'last' : 'first'))){ c.role = ''; c.conf = .3; c.why = 'duplicate of column ' + (prev.i + 1) }
      return;
    }
    seen.set(c.role, c);
  });
  // a lone "last" with a single-word "first"-ish column next to it
  if (!cols.some(c => c.role === 'name') && cols.some(c => c.role === 'last') && !cols.some(c => c.role === 'first')){
    const l = cols.find(c => c.role === 'last'), f = cols.find(c => c.i !== l.i && c.role === '' && c.samples.every(x => nameLike(x) && !/\s/.test(x)));
    if (f){ f.role = 'first'; f.conf = .55; f.why = 'single words next to the last names' }
  }
  if (!cols.some(c => ['name', 'first'].includes(c.role)) && cols.some(c => c.role === 'last')){ const l = cols.find(c => c.role === 'last'); if (l.samples.some(fullNameLike)){ l.role = 'name' } }
  const map = {}; cols.forEach(c => { if (c.role && c.role !== 'eventcol' && c.role !== 'event' && map[c.role] == null) map[c.role] = c.i });
  const people = cols.some(c => ['name', 'first', 'last'].includes(c.role));
  return {name:sheetName || '', rows, hi, header, cols, ctx, titles, people, width};
}

/* ---------- rows -> records ---------- */
function extract(sheet, colsOverride){
  const cols = colsOverride || sheet.cols, rows = sheet.rows, hi = sheet.hi;
  const by = role => cols.filter(c => c.role === role).map(c => c.i);
  const one = role => (by(role)[0]);
  const get = (r, role) => { const i = one(role); return i == null ? '' : clean(r[i]) };
  const sexHint = role => { const i = one(role); const h = i == null ? '' : normHead(sheet.header[i] || ''); return /\b(man|men|male|gentleman|his|husband|boy)\b/.test(h) ? 'M' : /\b(woman|women|female|lady|ladies|her|wife|girl)\b/.test(h) ? 'F' : '' };
  const recs = []; let section = null;
  const evCols = cols.filter(c => c.role === 'event'), flagCols = cols.filter(c => c.role === 'eventcol');
  const hasPeople = cols.some(c => ['name', 'first', 'last'].includes(c.role));
  if (!hasPeople) return recs;
  for (let ri = hi + 1; ri < rows.length; ri++){
    const r = rows[ri]; if (!r.some(Boolean)) continue;
    if (hi >= 0 && r.join('|').toLowerCase() === rows[hi].join('|').toLowerCase()) continue;
    const sec = sectionOf(r); if (sec){ section = sec; continue }
    let rawName = get(r, 'name'); const first = get(r, 'first'), last = get(r, 'last');
    if (!rawName) rawName = [first, last].filter(Boolean).join(' ');
    else if (first && !rawName.includes(first)) rawName = first + ' ' + rawName;
    if (!rawName) continue;
    let names = splitTeam(rawName).map(parseName).filter(Boolean);
    if (!names.length || BAD_NAME.test(names[0])) continue;
    const lvA = parseLevel(get(r, 'level') || get(r, 'ntrp'));
    const ntrp = (get(r, 'ntrp').match(/(\d(?:[.,]\d)?)\s*([csatmd])?\b/i) || []);
    const a = {name:names[0], sex:parseSex(get(r, 'sex')) || sexHint('name') || sexHint('first'), rating:lvA.rating ?? null, tier:lvA.tier || '', label:lvA.label || '', age:lvA.age || parseLevel(get(r, 'agegrp')).age || '',
      email:get(r, 'email').toLowerCase(), phone:get(r, 'phone'), club:get(r, 'club'), usta:get(r, 'usta').replace(/\D/g, ''),
      ntrp:ntrp[1] ? ntrp[1].replace(',', '.') : (lvA.rating != null && lvA.rating <= 7 && /^\d(\.\d)?$/.test(String(lvA.rating)) && one('level') != null && /ntrp/i.test(sheet.header[one('level')] || '') ? String(lvA.rating) : ''), ntrp_type:(ntrp[2] || lvA.ntrpType || '').toUpperCase(),
      wtn_s:get(r, 'wtn_s'), wtn_d:get(r, 'wtn_d'), utr:get(r, 'utr')};
    if (!a.sex && a.age === '' && parseSex(get(r, 'agegrp'))) a.sex = parseSex(get(r, 'agegrp'));
    // partner info on the same row
    const p2name = parseName(get(r, 'partner') || [get(r, 'p2first'), get(r, 'p2last')].filter(Boolean).join(' '));
    const p2 = {sex:parseSex(get(r, 'p2sex')) || sexHint('partner'), email:get(r, 'p2email').toLowerCase(), phone:get(r, 'p2phone'), usta:get(r, 'p2usta').replace(/\D/g, '')};
    const lvB = parseLevel(get(r, 'p2level')); if (lvB.rating != null) p2.rating = lvB.rating; if (lvB.tier) p2.tier = lvB.tier;
    const partners = {};
    const pcol = one('partner') != null ? one('partner') : one('p2first'), ph = pcol == null ? '' : normHead(sheet.header[pcol] || '');
    const teamRow = names.length >= 2 || !ph || /player 2|player two|^p2|second player|2nd player/.test(ph) || cols.some(c => c.role === 'p2level' || c.role === 'p2email');
    if (names.length >= 2) partners.any = Object.assign({name:names[1], team:true}, p2);
    else if (p2name) partners.any = Object.assign({name:p2name, team:teamRow}, p2);
    const pd = parseName(get(r, 'partner_d')), px = parseName(get(r, 'partner_x'));
    if (get(r, 'partner_d')) partners.d = {name:pd, raw:get(r, 'partner_d')};
    if (get(r, 'partner_x')) partners.x = {name:px, raw:get(r, 'partner_x')};
    if (partners.any && NEED_PARTNER.test(get(r, 'partner'))) partners.any = {name:'', raw:get(r, 'partner'), need:true};
    ['d', 'x'].forEach(k => { if (partners[k] && (NEED_PARTNER.test(partners[k].raw) || !partners[k].name)) partners[k] = {name:'', raw:partners[k].raw, need:true} });
    // team rating
    const tr = parseLevel(get(r, 'teamrating')).rating;
    // events
    const evs = [];
    evCols.forEach(c => parseEvents(r[c.i]).forEach(e => evs.push(Object.assign(e, {src:'col'}))));
    flagCols.forEach(c => {
      const val = clean(r[c.i]); if (!val || FALSY.test(val)) return;
      const base = Object.assign({}, c.ev || parseEventItem(c.header) || {kind:null}); delete base.raw;
      const e = Object.assign(base, {src:'flag', raw:c.header});
      if (TRUTHY.test(val)){} else if (NEED_PARTNER.test(val)) e.needPartner = true;
      else { const inner = parseEventItem(val); const lv = parseLevel(val);
        if (fullNameLike(val) || (nameLike(val) && !inner && lv.rating == null)) e.partner = parseName(val);
        else if (inner){ ['gender', 'level', 'cap', 'tier', 'label', 'age'].forEach(k => { if (inner[k] != null && inner[k] !== '' && (e[k] == null || e[k] === '')) e[k] = inner[k] }); if (inner.kind && !e.kind) e.kind = inner.kind; if (inner.partner) e.partner = inner.partner }
        else if (lv.rating != null){ if (e.kind === 'mixed' || lv.rating > 7.5) e.cap = lv.rating; else e.level = lv.rating }
        else if (lv.tier) e.tier = lv.tier; }
      evs.push(e);
    });
    recs.push({src:{sheet:sheet.name, row:ri + 1}, a, partners, events:evs, section:section || null, ctx:sheet.ctx || {}, teamRating:tr ?? null});
  }
  return recs;
}

/* ---------- records -> people, entries, divisions ---------- */
const keyOf = n => normName(n);
function build(sheetRecs, opts){
  opts = opts || {};
  const existing = opts.players || [], cards = opts.cards || {}, sport = opts.sport || 'tennis';
  const moves = opts.moves || {}, sexFix = opts.sexFix || {}, sameAs = opts.sameAs || {}, notSame = opts.notSame || {}, defaultKind = opts.defaultKind || 'auto';
  const recs = [].concat(...sheetRecs);
  const warnings = [];
  /* 1. people: dedupe by USTA #, email (when names agree) and name */
  const people = new Map(); const alias = new Map();   // name key -> person key
  const conflicts = [];
  const resolveKey = k => { let x = k, g = 0; while (alias.has(x) && g++ < 20) x = alias.get(x); return x };
  const byUsta = new Map(), byEmail = new Map();
  const compatible = (n1, n2) => { const a = keyOf(n1).split(' '), b = keyOf(n2).split(' '); return a[a.length - 1] === b[b.length - 1] && sameFirst(a[0], b[0]) };
  function upsert(p, src, opt){
    if (!p || !p.name) return null;
    let k = keyOf(p.name); if (!k) return null;
    k = resolveKey(k);
    if (!people.has(k)){
      const u = p.usta && byUsta.get(p.usta), e = p.email && byEmail.get(p.email);
      const hit = u || (e && compatible(people.get(e).name, p.name) ? e : null);
      if (hit){ alias.set(k, hit); k = hit; people.get(k).merged.push(p.name) }
    }
    let x = people.get(k);
    if (!x){ x = {key:k, name:p.name, sex:'', sexSrc:'', rating:null, tier:'', label:'', age:'', email:'', phone:'', club:'', usta:'', ntrp:'', ntrp_type:'', wtn_s:'', wtn_d:'', utr:'', rows:[], merged:[], partnerOnly:true, warn:[]}; people.set(k, x) }
    if (!opt || !opt.stub) x.partnerOnly = false;
    if (src) x.rows.push(src);
    for (const f of ['email', 'phone', 'club', 'usta', 'ntrp', 'ntrp_type', 'wtn_s', 'wtn_d', 'utr', 'age', 'label']) if (p[f] && !x[f]) x[f] = p[f];
    if (p.sex){ if (x.sex && x.sex !== p.sex && x.sexSrc === 'file') conflicts.push([x.key, 'sex', x.sex, p.sex]); if (!x.sex || x.sexSrc !== 'file') { x.sex = p.sex; x.sexSrc = 'file' } }
    if (p.rating != null){ if (x.rating != null && Math.abs(x.rating - p.rating) > .01) conflicts.push([x.key, 'level', x.rating, p.rating]); else x.rating = p.rating }
    if (p.tier && !x.tier) x.tier = p.tier;
    if (x.usta) byUsta.set(x.usta, x.key); if (x.email) byEmail.set(x.email, x.key);
    return x.key;
  }
  (opts.merge || []).forEach(([keep, drop]) => { if (keep && drop && keep !== drop) alias.set(drop, keep) });
  recs.forEach(r => { r.aKey = upsert(r.a, r.src) });
  // partners named on rows become people too (they may never have their own row)
  const resolveName = (name, near) => {
    if (!name) return null;
    let k = resolveKey(keyOf(name)); if (people.has(k)) return {key:k, how:'exact'};
    const w = keyOf(name).split(' '), cands = [];
    people.forEach(p => { const q = p.key.split(' '); if (w.length >= 2 && q.length >= 2 && q[q.length - 1] === w[w.length - 1] && sameFirst(q[0], w[0])) cands.push(p.key); else if (w.length === 1 && q[q.length - 1] === w[0]) cands.push(p.key); else if (w.length >= 2 && q.length >= 2 && Math.min(p.key.length, k.length) >= 8 && lev(p.key, k) <= 2) cands.push(p.key) });
    const pool = near && cands.length > 1 ? cands.filter(near) : cands;
    if (pool.length === 1) return {key:pool[0], how:'fuzzy'};
    return null;
  };
  /* 2. entries: one per (person, event) */
  const raw = [];   // {pKey, ev, partner:{name, info, need}, src}
  recs.forEach(r => {
    if (!r.aKey) return;
    let evs = r.events.slice();
    const ctxEv = Object.assign({}, r.ctx || {}, r.section || {}); delete ctxEv.raw; delete ctxEv.partner;
    const ctxHas = ctxEv.kind || ctxEv.level != null || ctxEv.cap != null || ctxEv.tier || ctxEv.label || ctxEv.age || ctxEv.gender;
    if (!evs.length && ctxHas) evs = [Object.assign({}, ctxEv, {src:'section'})];
    else if (evs.length && ctxHas) evs = evs.map(e => { const o = Object.assign({}, e); ['gender', 'level', 'cap', 'tier', 'label', 'age', 'junior'].forEach(k => { if ((o[k] == null || o[k] === '' || o[k] === false) && ctxEv[k] != null && ctxEv[k] !== '' && !(k === 'gender' && o.kind === 'mixed') && !(k === 'level' && o.kind === 'mixed')) o[k] = ctxEv[k] }); if (!o.kind && ctxEv.kind) o.kind = ctxEv.kind; return o });
    if (!evs.length) evs = [{kind:null, gender:'', level:null, cap:null, src:r.partners.any || r.partners.d || r.partners.x ? 'partner' : 'none'}];
    if (ctxEv.gender && !people.get(r.aKey).sex && !(evs.every(e => e.kind === 'mixed'))){ /* sheet/section says Men's or Women's */ }
    // which partner goes with which event
    const dbl = evs.filter(e => e.kind === 'doubles' || e.kind === 'mixed' || (!e.kind && (r.partners.any || r.partners.d)));
    evs.forEach(e => {
      let pt = null;
      if (e.partner) pt = {name:parseName(e.partner)};
      else if (e.needPartner) pt = {need:true};
      else if (e.kind === 'mixed' && r.partners.x) pt = r.partners.x;
      else if ((e.kind === 'doubles' || !e.kind) && r.partners.d) pt = r.partners.d;
      else if (r.partners.any && (e.kind !== 'singles')){
        if (dbl.length <= 1 || (e.kind === 'doubles' && !dbl.some(z => z !== e && z.kind === 'doubles' && !z.partner))) pt = Object.assign({}, r.partners.any, {guess:dbl.length > 1});
        else if (e.kind === 'mixed' && !r.partners.x && !evs.some(z => z.kind === 'doubles' && !z.partner && !r.partners.d)) pt = r.partners.any;
      }
      if (pt && pt.need) pt = {need:true, raw:pt.raw};
      raw.push({pKey:r.aKey, ev:e, partner:pt, src:r.src, teamRating:r.teamRating});
    });
  });
  // create partner-only people
  raw.forEach(x => {
    if (!x.partner || !x.partner.name) return;
    const res = resolveName(x.partner.name);
    if (res){ x.qKey = res.key; x.qHow = res.how; const q = people.get(res.key); if (x.partner.sex && !q.sex) { q.sex = x.partner.sex; q.sexSrc = 'file' } if (x.partner.rating != null && q.rating == null) q.rating = x.partner.rating; if (x.partner.email && !q.email) q.email = x.partner.email; if (x.partner.phone && !q.phone) q.phone = x.partner.phone; if (x.partner.usta && !q.usta) q.usta = x.partner.usta }
    else { x.qKey = upsert(Object.assign({name:x.partner.name}, x.partner), null, {stub:true}); x.qHow = 'new' }
    if (x.qKey === x.pKey){ x.qKey = null; x.selfPartner = true }
  });
  /* 3. sex: file > division name > existing roster > mixed partner opposite > first-name suggestion (not applied) */
  const exByKey = new Map(existing.map(p => [keyOf(p.name), p]));
  const exByEmail = new Map(existing.filter(p => p.email).map(p => [String(p.email).toLowerCase(), p]));
  const exByUsta = new Map(); existing.forEach(p => { const u = cards[p.id] && String(cards[p.id].usta || '').replace(/\D/g, ''); if (u) exByUsta.set(u, p) });
  people.forEach(p => {
    if (sameAs[p.key] === '' || notSame[p.key]) p.existingId = null;
    const ex = (p.usta && exByUsta.get(p.usta)) || exByKey.get(p.key) || (p.email && exByEmail.get(p.email) && compatible(exByEmail.get(p.email).name, p.name) ? exByEmail.get(p.email) : null);
    if (ex && !notSame[p.key]){ p.existingId = ex.id; p.existing = {name:ex.name, rating:ex.rating ?? null, tier:ex.tier || '', gender:ex.gender || ''} }
    if (sameAs[p.key]){ const e2 = existing.find(q => q.id === sameAs[p.key]); if (e2){ p.existingId = e2.id; p.existing = {name:e2.name, rating:e2.rating ?? null, tier:e2.tier || '', gender:e2.gender || ''} } }
    if (!p.existingId && !notSame[p.key]){
      const w = p.key.split(' ');
      const near = existing.filter(q => { const k = keyOf(q.name).split(' '); return w.length > 1 && k.length > 1 && k[k.length - 1] === w[w.length - 1] && k[0] !== w[0] && sameFirst(k[0], w[0]) || (Math.min(keyOf(q.name).length, p.key.length) >= 7 && lev(keyOf(q.name), p.key) === 1) });
      if (near.length === 1) p.maybeExisting = {id:near[0].id, name:near[0].name};
    }
  });
  const evSex = new Map();
  raw.forEach(x => { const g = x.ev.kind !== 'mixed' && x.ev.gender; if (g){ [x.pKey, x.qKey].filter(Boolean).forEach(k => { const s = evSex.get(k) || new Set(); s.add(g); evSex.set(k, s) }) } });
  people.forEach(p => {
    if (sexFix[p.key]){ p.sex = sexFix[p.key]; p.sexSrc = 'director'; return }
    const es = evSex.get(p.key);
    if (p.sex){ if (es && es.size === 1 && !es.has(p.sex)) p.warn.push({t:'sexMismatch', msg:`Sex says ${p.sex} but entered in a ${[...es][0] === 'M' ? "men's" : "women's"} event`}); return }
    if (es && es.size === 1){ p.sex = [...es][0]; p.sexSrc = 'event'; return }
    if (p.existing && p.existing.gender){ p.sex = p.existing.gender; p.sexSrc = 'roster'; return }
  });
  for (let pass = 0; pass < 3; pass++) raw.forEach(x => { if (x.ev.kind !== 'mixed' || !x.qKey) return; const a = people.get(x.pKey), b = people.get(x.qKey); if (a.sex && !b.sex){ b.sex = a.sex === 'M' ? 'F' : 'M'; b.sexSrc = 'mixed partner' } else if (b.sex && !a.sex){ a.sex = b.sex === 'M' ? 'F' : 'M'; a.sexSrc = 'mixed partner' } });
  people.forEach(p => { if (!p.sex){ const g = guessSexFromFirst(p.name); if (g) p.sexGuess = g } });
  people.forEach(p => { if (p.rating == null && p.existing && p.existing.rating != null) { p.rating = p.existing.rating; p.ratingSrc = 'roster' } if (!p.tier && p.existing && p.existing.tier) p.tier = p.existing.tier });
  conflicts.forEach(([k, f, a, b]) => { const p = people.get(resolveKey(k)); if (p) p.warn.push({t:'conflict', msg:`Two different ${f === 'sex' ? 'M/F values' : 'levels'} in the file (${f === 'level' ? fmtLv(a) : a} and ${f === 'level' ? fmtLv(b) : b})`}) });
  /* 4. pair doubles: mutual references first, then one-sided */
  const kindOf = x => x.ev.kind || (x.qKey || x.partner ? 'doubles' : null);
  const isDbl = k => k === 'doubles' || k === 'mixed';
  const entries = [];
  const used = new Set();   // raw idx consumed
  const slotKey = (k, x) => k + '|' + kindOf(x) + '|' + (x.ev.kind === 'mixed' ? '' : x.ev.gender || '') + '|' + (x.ev.level ?? x.ev.cap ?? x.ev.tier ?? x.ev.label ?? '');
  const findRaw = (pKey, kind, prefer) => { const c = raw.map((x, i) => [x, i]).filter(([x, i]) => !used.has(i) && x.pKey === pKey && (kindOf(x) === kind || (!x.ev.kind && isDbl(kind)))); return (prefer ? c.find(([x]) => prefer(x)) : null) || c[0] || null };
  const evMerge = (e1, e2) => { const o = Object.assign({}, e1); ['kind', 'gender', 'level', 'cap', 'tier', 'label', 'age', 'junior', 'plus'].forEach(k => { if ((o[k] == null || o[k] === '' || o[k] === false) && e2 && e2[k] != null && e2[k] !== '') o[k] = e2[k] }); return o };
  const evDiffer = (e1, e2) => e1 && e2 && ((e1.level != null && e2.level != null && e1.level !== e2.level) || (e1.cap != null && e2.cap != null && e1.cap !== e2.cap) || (e1.gender && e2.gender && e1.gender !== e2.gender && e1.kind !== 'mixed'));
  const push = (members, ev, ws, src, tr) => entries.push({members, ev, warn:ws || [], src, teamRating:tr ?? null});
  // mutual
  raw.forEach((x, i) => {
    if (used.has(i) || !x.qKey || !isDbl(kindOf(x))) return;
    const k = kindOf(x);
    const back = findRaw(x.qKey, k, y => y.qKey === x.pKey);
    if (back && back[0].qKey === x.pKey){
      used.add(i); used.add(back[1]);
      const ws = []; if (evDiffer(x.ev, back[0].ev)) ws.push({t:'divMismatch', msg:`Partners listed different divisions (${x.ev.raw || ''} / ${back[0].ev.raw || ''})`});
      if (x.qHow === 'fuzzy' || back[0].qHow === 'fuzzy') ws.push({t:'partnerFuzzy', msg:`Partner name matched loosely ("${x.partner.name}")`, lvl:'info'});
      push([x.pKey, x.qKey], evMerge(evMerge(x.ev, back[0].ev), {kind:k}), ws, x.src, x.teamRating ?? back[0].teamRating);
    }
  });
  // one-sided (B didn't name anyone, or never registered) and conflicts
  raw.forEach((x, i) => {
    if (used.has(i) || !x.qKey || !isDbl(kindOf(x))) return;
    const k = kindOf(x), other = findRaw(x.qKey, k);
    if (other && other[0].qKey && other[0].qKey !== x.pKey){
      // B named someone else
      if (!entries.some(e => e.conflictOf === x.pKey)) warnings.push({t:'partnerConflict', msg:`${people.get(x.pKey).name} named ${people.get(x.qKey).name} as partner, but ${people.get(x.qKey).name} named ${people.get(other[0].qKey).name}`});
      used.add(i); push([x.pKey], evMerge(x.ev, {kind:k}), [{t:'partnerConflict', msg:`Named ${people.get(x.qKey).name}, who named ${people.get(other[0].qKey).name}`}], x.src);
      return;
    }
    // partner already in a team for this kind?
    if (entries.some(e => e.ev.kind === k && e.members.length === 2 && e.members.includes(x.qKey))){
      used.add(i); push([x.pKey], evMerge(x.ev, {kind:k}), [{t:'partnerConflict', msg:`Named ${people.get(x.qKey).name}, who is already on another team`}], x.src); return;
    }
    used.add(i); if (other) used.add(other[1]);
    const q = people.get(x.qKey), ws = [];
    if (x.partner && x.partner.team){ /* a team typed on one row: nothing to check */ }
    else if (q.partnerOnly) ws.push({t:'partnerOnly', msg:`${q.name} is only listed as a partner (no row of their own)`, lvl:'info'});
    else if (other) ws.push({t:'oneSided', msg:`${q.name} didn't list a partner; paired with ${people.get(x.pKey).name}`, lvl:'info'});
    else ws.push({t:'oneSided', msg:`${q.name} has a row but isn't entered in this event; added with ${people.get(x.pKey).name}`});
    if (x.qHow === 'fuzzy') ws.push({t:'partnerFuzzy', msg:`Partner "${x.partner.name}" matched to ${q.name}`});
    if (x.partner && x.partner.guess) ws.push({t:'partnerGuess', msg:'One partner column but several doubles events; check this team'});
    push([x.pKey, x.qKey], evMerge(evMerge(x.ev, other && other[0].ev), {kind:k}), ws, x.src, x.teamRating);
  });
  // everyone left: singles, unpaired doubles, or no event
  raw.forEach((x, i) => {
    if (used.has(i)) return; used.add(i);
    const k = kindOf(x), ws = [];
    if (isDbl(k)) ws.push(x.partner && x.partner.need ? {t:'needPartner', msg:'Needs a partner'} : x.selfPartner ? {t:'unpaired', msg:'Listed themself as partner'} : {t:'unpaired', msg:'No partner listed'});
    if (!k) ws.push({t:'noEvent', msg:'No event listed', lvl:'info'});
    push([x.pKey], evMerge(x.ev, {kind:k}), ws, x.src);
  });
  // a row with no event for someone who is entered elsewhere adds nothing
  for (let i = entries.length - 1; i >= 0; i--){ const e = entries[i]; if (e.ev.src === 'none' && e.members.length === 1 && entries.some(o => o !== e && o.members.includes(e.members[0]))) entries.splice(i, 1) }
  // repeated rows for the same person+event collapse into one entry
  const seenE = new Map(), out = [];
  entries.forEach(e => { const id = (e.ev.kind || '?') + ':' + e.members.slice().sort().join('+') + ':' + (e.ev.kind === 'mixed' ? '' : e.ev.gender || '') + ':' + (e.ev.level ?? e.ev.cap ?? e.ev.tier ?? e.ev.label ?? ''); if (seenE.has(id)){ const p = seenE.get(id); p.repeat = (p.repeat || 1) + 1; return } e.id = id; seenE.set(id, e); out.push(e) });
  // a person who is unpaired in an event but also part of a team in the same event: drop the unpaired duplicate
  const final = out.filter(e => !(e.members.length === 1 && isDbl(e.ev.kind) && out.some(o => o !== e && o.members.length === 2 && o.members.includes(e.members[0]) && o.ev.kind === e.ev.kind && !evDiffer(o.ev, e.ev))));
  /* 5. division for each entry: event says it; else from the players' sex and level */
  const kindOnlyNull = final.every(e => !e.ev.kind);
  final.forEach(e => {
    const d = Object.assign({kind:null, gender:'', level:null, cap:null, tier:'', label:'', age:'', junior:false}, e.ev);
    delete d.raw; delete d.src; delete d.partner; delete d.needPartner;
    const ps = e.members.map(k => people.get(k));
    if (!d.kind && defaultKind !== 'auto' && defaultKind !== 'roster') d.kind = defaultKind;
    if (!d.kind && e.ev.src === 'section'){ d.kind = e.members.length === 2 ? 'doubles' : null }
    if (d.kind === 'doubles' && ps.length === 2 && ps[0].sex && ps[1].sex && ps[0].sex !== ps[1].sex && !d.gender){ d.kind = 'mixed'; e.warn.push({t:'madeMixed', msg:'A man and a woman: sorted into mixed', lvl:'info'}) }
    if (d.kind === 'mixed'){ d.gender = ''; if (ps.length === 2 && ps[0].sex && ps[0].sex === ps[1].sex) e.warn.push({t:'mixedSameSex', msg:'Mixed team with two ' + (ps[0].sex === 'M' ? 'men' : 'women')}) }
    else if (!d.gender){ const sx = [...new Set(ps.map(p => p.sex).filter(Boolean))]; if (sx.length === 1 && (d.kind || !kindOnlyNull)) d.gender = sx[0]; else if (sx.length === 1) d.gender = sx[0] }
    const explicitLv = d.level != null || d.cap != null || d.tier || d.label;
    const rts = ps.map(p => p.rating), allRated = rts.every(x => x != null);
    if (!explicitLv){
      if (d.kind === 'mixed'){ const t = e.teamRating ?? (allRated && ps.length === 2 ? rts[0] + rts[1] : null); if (t != null && sport === 'tennis') d.cap = Math.ceil(t - 1e-9); else if (t != null) d.cap = round(t, 2) }
      else if (ps.some(p => p.tier) && ps.every(p => p.tier || p.rating == null)) d.tier = ps.map(p => p.tier).filter(Boolean).sort()[0];
      else if (rts.some(x => x != null)){ const m = Math.max(...rts.filter(x => x != null)); d.level = sport === 'tennis' ? floorHalf(m) : floorHalf(m) }
      else if (ps.some(p => p.label)) d.label = ps.map(p => p.label).filter(Boolean)[0];
      if (d.level == null && d.cap == null && !d.tier && !d.label && e.teamRating != null && d.kind === 'doubles' && sport === 'tennis') d.level = floorHalf(e.teamRating > 7.5 ? e.teamRating / 2 : e.teamRating);
      e.lvFrom = d.level != null || d.cap != null || d.tier || d.label ? 'rating' : '';
    } else e.lvFrom = 'event';
    if (!d.age){ const ag = ps.map(p => p.age).filter(Boolean); if (ag.length) d.age = ag[0] }
    if (d.kind !== 'mixed' && d.gender && d.kind) ps.forEach(p => { if (!p.sex){ p.sex = d.gender; p.sexSrc = 'division' } });
    e.division = d;
    // checks
    if (d.level == null && d.cap == null && !d.tier && !d.label && !d.age && d.kind) e.warn.push({t:'noLevel', msg:'No level found'});
    if (d.kind !== 'mixed' && ps.some(p => !p.sex) && !d.gender) e.warn.push({t:'noSex', msg:'M/F unknown'});
    if (e.lvFrom === 'event' && d.level != null && sport === 'tennis') ps.forEach(p => { if (p.rating != null && p.rating > d.level + .01 && !d.plus) e.warn.push({t:'rateHigh', msg:`${p.name} is rated ${fmtLv(p.rating)}, above this ${fmtLv(d.level)} division`}); else if (p.rating != null && p.rating < d.level - 1.01) e.warn.push({t:'rateLow', msg:`${p.name} is rated ${fmtLv(p.rating)}, well below ${fmtLv(d.level)}`, lvl:'info'}) });
    if (e.lvFrom === 'event' && d.cap != null && sport === 'tennis' && ps.length === 2 && allRated && rts[0] + rts[1] > d.cap + .01) e.warn.push({t:'rateHigh', msg:`Team adds up to ${fmtLv(rts[0] + rts[1])}, over the ${fmtLv(d.cap)} limit`});
    if (d.kind && d.kind !== 'mixed' && d.gender && ps.some(p => p.sex && p.sex !== d.gender && p.sexSrc !== 'event')) e.warn.push({t:'sexMismatch', msg:`${ps.filter(p => p.sex && p.sex !== d.gender).map(p => p.name).join(', ')} is listed ${d.gender === 'M' ? 'F' : 'M'} in a ${d.gender === 'M' ? "men's" : "women's"} division`});
    if (e.repeat) e.warn.push({t:'repeat', msg:`Listed ${e.repeat} times; added once`, lvl:'info'});
  });
  for (let pass = 0; pass < 2; pass++) final.forEach(e => { if (e.division.kind !== 'mixed' || e.members.length !== 2) return; const [a, b] = e.members.map(k => people.get(k)); if (a.sex && !b.sex){ b.sex = a.sex === 'M' ? 'F' : 'M'; b.sexSrc = 'mixed partner' } else if (b.sex && !a.sex){ a.sex = b.sex === 'M' ? 'F' : 'M'; a.sexSrc = 'mixed partner' } });
  people.forEach(p => { if (p.sex) delete p.sexGuess });
  final.forEach(e => { if (e.warn.some(w => w.t === 'noSex') && e.members.every(k => people.get(k).sex)) e.warn = e.warn.filter(w => w.t !== 'noSex') });
  /* 6. director moves, then group */
  final.forEach(e => { e.key = groupKey(e.division); if (moves[e.id]){ e.movedFrom = e.key; e.key = moves[e.id]; e.division = Object.assign({}, parseGroupKey(moves[e.id])); e.warn = e.warn.filter(w => !['noLevel', 'noSex', 'rateHigh', 'rateLow', 'sexMismatch', 'madeMixed', 'noEvent'].includes(w.t)) } });
  const groups = new Map();
  final.forEach(e => {
    if (!groups.has(e.key)){ const d = parseGroupKey(e.key); groups.set(e.key, {key:e.key, division:d, label:eventLabel(d, sport), entries:[]}) }
    groups.get(e.key).entries.push(e);
  });
  const kOrder = {singles:0, doubles:1, mixed:2, null:3};
  const glist = [...groups.values()].sort((a, b) => (kOrder[a.division.kind] - kOrder[b.division.kind]) || (a.division.gender || 'Z').localeCompare(b.division.gender || 'Z') || ((a.division.level ?? a.division.cap ?? 99) - (b.division.level ?? b.division.cap ?? 99)) || a.label.localeCompare(b.label));
  /* 7. possible duplicates within the file (not merged: the director decides) */
  const plist = [...people.values()], dupes = [];
  for (let i = 0; i < plist.length; i++) for (let j = i + 1; j < plist.length; j++){
    const a = plist[i].key.split(' '), b = plist[j].key.split(' ');
    if (a.length < 2 || b.length < 2) continue;
    if ((opts.notDupes || []).some(([x, y]) => (x === plist[i].key && y === plist[j].key) || (y === plist[i].key && x === plist[j].key))) continue;
    if ((a[a.length - 1] === b[b.length - 1] && a[0] !== b[0] && sameFirst(a[0], b[0])) || (a[0] === b[0] && a[a.length - 1] !== b[b.length - 1] && lev(a[a.length - 1], b[b.length - 1]) === 1 && a[a.length - 1].length >= 5)) dupes.push([plist[i].key, plist[j].key]);
  }
  plist.forEach(p => { if (p.merged.length) p.warn.push({t:'merged', msg:`Same USTA # or email as "${p.merged.join('", "')}"; merged`, lvl:'info'}) });
  const used2 = new Set(final.flatMap(e => e.members));
  return {people:plist.filter(p => used2.has(p.key)), byKey:people, entries:final, groups:glist, dupes, warnings, sexUnknown:plist.filter(p => used2.has(p.key) && !p.sex)};
}

/* Pasted text -> table rows (tabs from a spreadsheet copy, CSV, semicolons, pipes or 2+ spaces) */
function tablesFromText(text){
  const lines = S(text).replace(/\r\n?/g, '\n').split('\n');
  const sample = lines.filter(l => l.trim()).slice(0, 30);
  const count = (re) => sample.filter(l => re.test(l)).length;
  let rows;
  if (count(/\t/) >= sample.length * .5) rows = lines.map(l => l.split('\t'));
  else if (count(/,/) >= sample.length * .5 && sample.filter(l => (l.match(/,/g) || []).length >= 2).length >= sample.length * .4) rows = csvRows(text);
  else if (count(/;/) >= sample.length * .5) rows = lines.map(l => l.split(';'));
  else if (count(/\|/) >= sample.length * .5) rows = lines.map(l => l.replace(/^\s*\||\|\s*$/g, '').split('|')).filter(r => !r.every(c => /^\s*:?-{2,}:?\s*$/.test(c)));
  else if (count(/\S {2,}\S/) >= sample.length * .5) rows = lines.map(l => l.trim().split(/ {2,}/));
  else rows = lines.map(l => [l]);
  return [{name:'Pasted', rows:rows.map(r => r.map(c => c.trim()))}];
}
function csvRows(text){
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i];
    if (q){ if (ch === '"'){ if (text[i + 1] === '"'){ cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true; else if (ch === ','){ row.push(cur); cur = '' } else if (ch === '\n' || ch === '\r'){ if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = '' } else cur += ch;
  }
  if (cur || row.length){ row.push(cur); out.push(row) }
  return out;
}
/* One-shot: tables -> analysis + result (for tests and the app's first look) */
function run(tables, opts){
  opts = opts || {};
  const sheets = tables.map((t, i) => analyzeSheet(t.rows || t, t.name || ('Sheet ' + (i + 1)), {hi:(opts.hi || {})[i]}));
  const useSheets = sheets.map((s, i) => opts.sheets ? opts.sheets.includes(i) : s.people);
  const recs = sheets.map((s, i) => useSheets[i] ? extract(s, (opts.cols || {})[i]) : []);
  return Object.assign({sheets, use:useSheets, records:recs}, build(recs, opts));
}

const API = {clean, normName, parseName, splitTeam, parseSex, parseLevel, parseEventItem, parseEvents, eventLabel, groupKey, parseGroupKey, headerRole, sniff, findHeader, analyzeSheet, extract, build, run, tablesFromText, csvRows, guessSexFromFirst, ROLES, fmtLv};
if (typeof module !== 'undefined' && module.exports) module.exports = API;
root.SmartImport = API;
})(typeof window !== 'undefined' ? window : globalThis);
