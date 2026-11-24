// Accessibility check: axe-core (WCAG 2.0/2.1/2.2 A + AA rules) on every screen and dialog state,
// plus 320px reflow, 200% text size and 44px target-size checks.
// Usage: npm run build && npm run preview, then  node e2e/a11y.mjs [baseUrl]
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "./pw.mjs";

const base = process.argv[2] ?? "http://localhost:4174/";
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch();
let failures = 0;

async function audit(page, label) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } }),
  );
  // Small targets: every interactive control must be at least 44 x 44 CSS px.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, a[href], input, select, textarea, [role=switch]")]
      .filter((el) => (el.offsetParent !== null || el.closest("dialog[open]")) && !el.matches(".sr-only"))
      .map((el) => {
        const t = el.closest("label") ?? el;
        const b = t.getBoundingClientRect();
        return { el: (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().slice(0, 40), w: Math.round(b.width), h: Math.round(b.height) };
      })
      .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)),
  );
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const issues = r.violations.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) → ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
  if (small.length) issues.push(`target-size<44: ${small.map((s) => `${s.el} ${s.w}x${s.h}`).join("; ")}`);
  if (overflow) issues.push("horizontal scroll (reflow)");
  failures += issues.length;
  console.log(`${issues.length ? "FAIL" : "ok  "} ${label}${issues.map((i) => `\n       ${i}`).join("")}`);
}

const viewports = [
  { name: "phone 390", width: 390, height: 844 },
  { name: "reflow 320", width: 320, height: 640 },
  { name: "desktop 1280", width: 1280, height: 900 },
];

for (const vp of viewports) {
  for (const zoom of vp.width === 390 ? [1, 2] : [1]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const tag = `[${vp.name}${zoom === 2 ? ", text 200%" : ""}]`;
    const go = async (hash, study = false) => {
      await page.goto(`${base}${study ? "?study=1" : ""}#/${hash}`);
      if (zoom === 2) await page.addStyleTag({ content: "html{font-size:200% !important}" });
      await page.locator("#page-title").waitFor();
    };
    await go("");
    await page.evaluate(() => localStorage.clear());
    await go("");
    await audit(page, `${tag} messages`);
    await go("review");
    await audit(page, `${tag} note review`);
    await page.locator('[data-sentence="s3"]').click();
    await page.getByRole("button", { name: "This is wrong" }).click();
    await page.getByRole("button", { name: "Show the whole conversation" }).click();
    await audit(page, `${tag} sentence sheet (wrong + transcript)`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Something missing here? in What you told us" }).click();
    await page.getByRole("button", { name: "A symptom" }).click();
    await audit(page, `${tag} missing sheet`);
    await page.keyboard.press("Escape");
    await go("summary");
    await audit(page, `${tag} summary`);
    await go("sent");
    await audit(page, `${tag} sent`);
    await go("later");
    await audit(page, `${tag} remind later`);
    await go("clinician");
    await page.getByRole("button", { name: /Load example/ }).click();
    await page.getByRole("group", { name: "Decision for item 1" }).getByRole("button", { name: "Decline" }).click();
    await page.getByRole("button", { name: "Decline correction" }).click();
    await page.getByRole("group", { name: "Decision for item 2" }).getByRole("button", { name: "Accept" }).click();
    await audit(page, `${tag} clinician (with decline error)`);
    await go("review", true);
    await page.getByRole("button", { name: /Researcher/ }).click();
    await audit(page, `${tag} researcher panel`);
    await ctx.close();
  }
}

// Keyboard: the sheet traps focus, Escape closes it and focus returns to the sentence.
{
  const page = await browser.newPage();
  await page.goto(`${base}#/review`);
  await page.locator("#page-title").waitFor();
  await page.locator('[data-sentence="s4"]').focus();
  await page.keyboard.press("Enter");
  const inDialog = await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")));
  for (let i = 0; i < 40; i++) await page.keyboard.press("Tab");
  const stillIn = await page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")));
  await page.keyboard.press("Escape");
  const back = await page.evaluate(() => document.activeElement?.getAttribute("data-sentence"));
  const ok = inDialog && stillIn && back === "s4";
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} keyboard: focus into sheet ${inDialog}, kept after 40 tabs ${stillIn}, returned to ${back}`);
}

await browser.close();
console.log(failures ? `\n${failures} issue(s) found` : "\nNo accessibility issues found");
process.exitCode = failures ? 1 : 0;
