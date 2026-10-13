import {copyFile,mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('docs',{recursive:true});
await copyFile('shared/engine.js','docs/engine.js');
await copyFile('shared/engine.js','supabase/functions/_shared/engine.js');
const {CONFIG}=await import('../docs/config.js');
const version=CONFIG.version;
await writeFile('docs/version.json',JSON.stringify({version,year:2027}));
console.log('Built',version);
