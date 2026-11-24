// Loads Playwright through CommonJS resolution so a global install (NODE_PATH) or a local one both work.
// Locally: npm i -D playwright && npx playwright install chromium
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium, devices } = require("playwright");
