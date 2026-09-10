import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const src = 'node_modules/blockly/media';
const dest = 'static/blockly-media';

if (!existsSync(src)) {
	console.warn(`[copy-blockly-media] ${src} does not exist; skipping.`);
	process.exit(0);
}

await mkdir(dest, { recursive: true });
await cp(src, dest, { recursive: true });
console.log(`[copy-blockly-media] ${src} -> ${dest}`);
