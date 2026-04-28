import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const lucideEntry = path.resolve('node_modules/lucide-react/dist/esm/lucide-react.js');
const brokenImport = "import * as index from './icons/index.js';\nexport { index as icons };\n";

if (!existsSync(lucideEntry)) {
    console.log('[patch-lucide-react] lucide-react is not installed; skipping.');
    process.exit(0);
}

const source = readFileSync(lucideEntry, 'utf8');

if (!source.includes(brokenImport)) {
    console.log('[patch-lucide-react] lucide-react is already patched.');
    process.exit(0);
}

writeFileSync(lucideEntry, source.replace(brokenImport, ''), 'utf8');
console.log('[patch-lucide-react] Removed broken icons index export from lucide-react.');
