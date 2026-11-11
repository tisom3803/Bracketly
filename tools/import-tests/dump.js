const path = require('path'), fs = require('fs');
const X = require(process.env.XLSX_PATH || path.join(__dirname, '../../vendor/xlsx.full.min.js'));
const SI = require('../../smart-import.js');
function load(f){
  const p = path.join(__dirname, 'fixtures', f);
  if (/\.tsv$/.test(f)) return SI.tablesFromText(fs.readFileSync(p, 'utf8'));
  const wb = /\.csv$/.test(f) ? X.read(fs.readFileSync(p, 'utf8'), {type:'string', raw:false}) : X.read(fs.readFileSync(p), {type:'buffer'});
  return wb.SheetNames.map(n => ({name:n, rows:X.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:false, defval:''})}));
}
module.exports = {load, SI};
if (require.main === module){
  for (const f of process.argv.slice(2)){
    const r = SI.run(load(f));
    console.log('=====', f);
    r.sheets.forEach((s, i) => console.log(` sheet "${s.name}" use=${r.use[i]} hi=${s.hi} ctx=${JSON.stringify(s.ctx)}\n  ` + s.cols.map(c => `${c.i}:${c.header || '-'}=>${c.role || 'x'}(${c.conf})`).join(' | ')));
    r.groups.forEach(g => console.log(`  [${g.label}] ${g.entries.length}: ` + g.entries.map(e => e.members.map(k => { const p = r.byKey.get(k); return `${p.name}${p.sex ? ' ' + p.sex : ''}${p.rating != null ? ' ' + p.rating : ''}` }).join(' / ') + (e.warn.length ? ` {${e.warn.map(w => w.t).join(',')}}` : '')).join('; ')));
    console.log('  sexUnknown:', r.sexUnknown.map(p => p.name + (p.sexGuess ? '?' + p.sexGuess : '')).join(', '), '| dupes:', JSON.stringify(r.dupes), '| warnings:', r.warnings.map(w => w.msg).join(' ; '));
  }
}
