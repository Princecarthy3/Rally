const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'complete.sql');
let content = fs.readFileSync(sqlPath, 'utf8');

content = content.replace("  elsif r.game_type='skribbl' then", " elsif r.game_type='skribbl' then");
fs.writeFileSync(sqlPath, content, 'utf8');
console.log('Formatted complete.sql');
