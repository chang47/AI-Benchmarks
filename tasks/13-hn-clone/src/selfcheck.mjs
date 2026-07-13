// Local self-check for the HN clone. Runs Chromium (chrome channel, fallback install),
// loads src/index.html via file://, screenshots, and exercises the spec's behavior.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(__dirname, "index.html");
const fileUrl = pathToFileURL(indexPath).href;

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (e) {
    console.log("chrome channel unavailable, installing chromium…", e.message);
    try { execSync("npx playwright install chromium", { stdio: "inherit" }); } catch {}
    return await chromium.launch();
  }
}

const problems = [];
function check(cond, label, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`);
  if (!cond) problems.push(label);
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + e.message));

const networkRequests = [];
page.on("request", (r) => {
  const u = r.url();
  if (!u.startsWith("file:") && !u.startsWith("data:")) networkRequests.push(u);
});

await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.screenshot({ path: path.join(__dirname, "selfcheck.png"), fullPage: true });

// 1. title + no console errors + no external network
check((await page.title()) === "Hacker News", "title is exactly 'Hacker News'", await page.title());
check(consoleErrors.length === 0, "zero console errors", consoleErrors.join(" | "));
check(networkRequests.length === 0, "zero external network requests", networkRequests.join(" | "));

// 2. column geometry + colors
const geo = await page.evaluate(() => {
  const main = document.getElementById("hnmain");
  const cs = getComputedStyle(main);
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const ratio = main.getBoundingClientRect().width / window.innerWidth;
  return { bg: cs.backgroundColor, ratio, bodyBg, fontFamily: getComputedStyle(document.body).fontFamily };
});
check(geo.bg === "rgb(246, 246, 239)", "column bg is #f6f6ef", geo.bg);
check(Math.abs(geo.ratio - 0.85) < 0.02, "column is ~85% viewport width", geo.ratio.toFixed(3));
check(geo.bodyBg === "rgb(255, 255, 255)", "page background is white", geo.bodyBg);
check(/verdana/i.test(geo.fontFamily), "base font is Verdana", geo.fontFamily);

// 3/4/5 top bar
const header = await page.evaluate(() => {
  const h = document.getElementById("header");
  const nav = document.getElementById("nav-cell").innerText.replace(/\s+/g, " ").trim();
  const login = document.getElementById("login-cell").innerText.trim();
  const logo = !!document.querySelector(".logo-mark");
  const pagetopColor = getComputedStyle(document.querySelector(".pagetop a")).color;
  return { bg: getComputedStyle(h).backgroundColor, nav, login, logo, pagetopColor };
});
check(header.bg === "rgb(255, 102, 0)", "top bar is #ff6600", header.bg);
check(header.logo, "inline logo mark present");
check(/Hacker News new \| past \| comments \| ask \| show \| jobs \| submit/.test(header.nav), "nav text + order + | separators", header.nav);
check(header.login === "login", "login link present", header.login);
check(header.pagetopColor === "rgb(0, 0, 0)", "top-bar text is black", header.pagetopColor);

// 6/7/8/9/10/11 story list
const stories = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("#itemlist tr.athing")];
  return rows.map((r) => {
    const rank = r.querySelector(".rank")?.textContent || "";
    const title = r.querySelector(".titleline a")?.textContent || "";
    const domain = r.querySelector(".sitebit a")?.textContent || null;
    const arrow = r.querySelector(".votearrow");
    const arrowTitle = arrow?.getAttribute("title") || "";
    const arrowCursor = arrow ? getComputedStyle(arrow).cursor : "";
    const titleColor = getComputedStyle(r.querySelector(".titleline a")).color;
    const sub = r.nextElementSibling?.querySelector(".subtext")?.innerText.replace(/\s+/g, " ").trim() || "";
    return { rank, title, domain, arrowTitle, arrowCursor, titleColor, sub };
  });
});
check(stories.length >= 20, "at least 20 stories", String(stories.length));
check(stories.every((s, i) => s.rank === `${i + 1}.`), "ranks are 1. 2. 3. consecutive");
check(new Set(stories.map((s) => s.title)).size === stories.length, "all titles unique");
check(stories.every((s) => s.arrowTitle === "upvote"), "every arrow has title='upvote'");
check(stories.every((s) => s.arrowCursor === "pointer"), "arrows have cursor:pointer");
check(stories.every((s) => s.titleColor === "rgb(0, 0, 0)"), "titles are black");
const subRe = /^\d+ points by \S+ .+ ago \| hide \| \d+ comments$/;
check(stories.every((s) => subRe.test(s.sub)), "subtext matches '{n} points by {u} {age} | hide | {n} comments'", stories[0].sub);
const subtextColor = await page.evaluate(() => getComputedStyle(document.querySelector(".subtext")).color);
check(subtextColor === "rgb(130, 130, 130)", "subtext is #828282 gray", subtextColor);

// 15 More link
const more = await page.evaluate(() => document.querySelector(".morelink")?.textContent || "");
check(more === "More", "More link present", more);

// 13/14 upvote interaction — click story #3, verify +1, arrow hidden, story #4 unaffected
const before = await page.evaluate(() => ({
  s3: document.getElementById("score_3").textContent,
  s4: document.getElementById("score_4").textContent,
}));
await page.click("#story_3 .votearrow");
const after = await page.evaluate(() => ({
  s3: document.getElementById("score_3").textContent,
  s4: document.getElementById("score_4").textContent,
  arrowVisible: !!document.querySelector("#story_3 .votelinks .votearrow") &&
                getComputedStyle(document.querySelector("#story_3 .votearrow")).display !== "none",
}));
const b3 = parseInt(before.s3), a3 = parseInt(after.s3);
check(a3 === b3 + 1, "upvote increments THIS story by exactly 1", `${before.s3} -> ${after.s3}`);
check(/^\d+ points$/.test(after.s3), "keeps 'N points' wording", after.s3);
check(after.s4 === before.s4, "other story unaffected", `${before.s4} -> ${after.s4}`);
check(after.arrowVisible === false, "arrow disappears after voting");

// Second click must NOT increment again (at most once)
await page.evaluate(() => {
  const a = document.querySelector("#story_3 .votearrow");
  if (a) a.click();
});
const again = await page.evaluate(() => document.getElementById("score_3").textContent);
check(parseInt(again) === a3, "cannot upvote twice", again);

// 16 no horizontal scrollbar at 1024px
await page.setViewportSize({ width: 1024, height: 800 });
const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
check(noHScroll, "no horizontal scrollbar at 1024px");

console.log(`\n${problems.length === 0 ? "ALL CHECKS PASSED ✅" : "PROBLEMS: " + problems.length}`);
if (problems.length) console.log(problems.map((p) => " - " + p).join("\n"));

await browser.close();
process.exit(problems.length === 0 ? 0 : 1);
