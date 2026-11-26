// HomeLedger entrypoint (Node 22, standard library only).
// Copies app/ and screenshots/ beside this file into the output
// directory and writes dossier.json there with the vendored
// make.fun library. The grader runs this file twice and expects
// byte-identical output. Outside the grader, set
// MAKEFUN_OUTPUT_DIR to pick the output directory:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const target = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const shots = join(target, 'screenshots');

mkdirSync(target, { recursive: true });
cpSync(join(root, 'app'), join(target, 'app'), { recursive: true });
mkdirSync(shots, { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), shots, { recursive: true });
}

const dossier = buildDossier(target, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 16777216,
});
writeFileSync(join(target, 'dossier.json'), dossier);
