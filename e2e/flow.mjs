// End-to-end check of the study flow. Usage: npm run build && npm run preview, then
//   node e2e/flow.mjs [baseUrl]      (default http://localhost:4174/)
import { chromium, devices } from "./pw.mjs";
import { readFileSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:4174/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"], acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (ok, msg) => { if (!ok) { console.error("FAIL:", msg); process.exitCode = 1; } else console.log("ok  ", msg); };

await page.goto(`${base}?study=1#/`);
const panel = async () => { await page.getByRole("button", { name: /Researcher/ }).click(); return page.getByRole("dialog", { name: "Researcher panel" }); };

// Condition OFF: no confidence markers or switch.
let p = await panel();
await p.getByLabel("Participant ID").fill("T99");
await p.getByLabel("Confidence markers OFF").check();
await p.getByRole("button", { name: /Start task/ }).click();
await page.getByRole("button", { name: "Review my note" }).click();
check((await page.getByText("AI was less sure").count()) === 0, "markers hidden in OFF condition");
check((await page.getByRole("switch").count()) === 0, "patient switch hidden in study mode");

// Two taps to flag: sentence, then option.
const flag = async (id, option, reason, text) => {
  await page.locator(`[data-sentence="${id}"]`).click();
  await page.getByRole("button", { name: option }).click();
  if (reason) await page.getByRole("button", { name: reason }).click();
  if (text) await page.locator("#flag-text").fill(text);
  if (option !== "This is correct") await page.getByRole("button", { name: "Done" }).click();
};
await flag("s4", "This is wrong", "Wrong side of the body", "My left leg");
await flag("s15", "This is wrong", "Wrong number or amount");
await flag("s13", "I don't understand this");
await flag("s9", "This is wrong");
await flag("s1", "This is correct");
await page.getByRole("button", { name: /Something missing here\?\s+in Plan/ }).click();
await page.locator("#flag-text").fill("Foot tingling for two weeks");
await page.keyboard.press("Escape");

await page.getByRole("button", { name: "Review and send" }).click();
await page.waitForURL(/summary/, { timeout: 5000 }).catch(async () => console.log("URL", page.url(), await page.evaluate(() => [document.activeElement?.outerHTML.slice(0,120), !!document.querySelector("dialog[open]")])));
await page.getByRole("heading", { name: "Check your notes before sending" }).waitFor();
check((await page.getByRole("heading", { name: /Things to fix or explain \(5\)/ }).count()) === 1, "summary lists 5 issues");
await page.getByRole("button", { name: /^Remove: “You came in/ }).click();
await page.getByLabel(/Message to Dr. Lee/).fill("Thanks");
await page.getByRole("button", { name: "Send to Dr. Lee" }).click();
check(await page.getByRole("heading", { name: "Sent. Thank you!" }).isVisible(), "sent screen");

p = await panel();
check(await p.getByRole("heading", { name: "Seeded errors: 3 of 6 found" }).isVisible(), "score: 3 of 6 found (E1 keyword, E4, E5)");
check((await p.getByText("? Noticed (unclear)").count()) === 1, "hallucination counted as noticed");
check(await p.getByText(/(stopped)/).isVisible(), "timer stopped on send");
const [dl] = await Promise.all([page.waitForEvent("download"), p.getByRole("button", { name: /Session summary/ }).click()]);
const csv = readFileSync(await dl.path(), "utf8");
check(csv.includes("T99") && csv.includes("markers-off") && /errors_found/.test(csv), "summary CSV downloaded");
const [dl2] = await Promise.all([page.waitForEvent("download"), p.getByRole("button", { name: /Event log/ }).click()]);
const events = readFileSync(await dl2.path(), "utf8");
check(/sentence_opened,s4/.test(events) && /task_ended/.test(events), "event log has opens and task end");
await p.getByRole("button", { name: "Close" }).click();

// Clinician receives the corrections.
await page.goto(`${base}?study=1#/clinician`);
await page.getByRole("heading", { name: /Corrections \(/ }).waitFor();
check((await page.getByRole("group", { name: /Decision for item/ }).count()) === 5, "clinician sees 5 items");

check(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
