// Copies the MediaPipe WASM runtime that matches the installed @mediapipe/tasks-vision
// into public/ so the app never loads a mismatched version from a CDN.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe', 'wasm');
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log('MediaPipe WASM copied to public/mediapipe/wasm');
