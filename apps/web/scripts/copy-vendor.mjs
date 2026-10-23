// Copies the background-blur engine (MediaPipe, Apache-2.0) from node_modules into
// public/, so calls load it from our own site and never from a third-party CDN.
// Runs before `dev` and `build`; the copied files are not committed (.gitignore).
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const from = path.join(path.dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
const to = path.join(import.meta.dirname, "..", "public", "vendor", "mediapipe", "wasm");
if (!existsSync(from)) throw new Error(`MediaPipe files not found in ${from}`);
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
