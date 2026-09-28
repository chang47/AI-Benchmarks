// Workspace preparation from a PREPARED DIRECTORY (bench.json `workspace.from`): a whole repo incl. node_modules
// and .git is copied into the agent's workspace, optionally at a SHORT root (C:\b\<id>) to stay under MAX_PATH.
//
// Real copies only. Links inside the source (npm-workspaces junctions under node_modules) are handled so that NOTHING
// in the workspace points back into the source or anywhere outside the workspace (the 2026-06-18 junction data-loss lesson):
//   - a link whose target is INSIDE the source dir is re-created pointing at the same place inside the workspace
//     (so `node_modules/@app/x` still resolves to the workspace's own `packages/x`, and edits there are seen);
//   - a link whose target is OUTSIDE the source dir is dereferenced (its content is copied);
//   - a broken link is skipped.
// A final walk verifies no link in the workspace resolves outside it; otherwise the prepare fails (and cleans up).
import { spawnSync } from "node:child_process";
import {
  copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { rand4 } from "./util.mjs";

const WIN = process.platform === "win32";

/** Base dir for short workspaces: VBENCH_SHORT_ROOT, else C:\b on Windows, else <tmp>/b. */
export const shortRootBase = () => process.env.VBENCH_SHORT_ROOT || (WIN ? "C:\\b" : join(tmpdir(), "b"));

/** Create an empty, unique short workspace dir: <base>\<tag>-<4hex>. */
export function makeShortWorkspace(tag) {
  const base = shortRootBase();
  mkdirSync(base, { recursive: true });
  for (let i = 0; i < 20; i++) {
    const ws = join(base, `${tag}-${rand4()}`);
    if (existsSync(ws)) continue;
    mkdirSync(ws);
    return ws;
  }
  throw new Error(`could not allocate a short workspace under ${base}`);
}

const inside = (root, p) => { const r = relative(root, p); return r === "" || (!r.startsWith("..") && !isAbsolute(r)); };

/** lstat-only walk (never follows links). Returns { files: [{rel, size}], dirs: [rel], links: [{rel}] }. */
export function walkNoFollow(root) {
  const out = { files: [], dirs: [], links: [] };
  const rec = (rel) => {
    for (const d of readdirSync(join(root, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isSymbolicLink()) out.links.push({ rel: r });
      else if (d.isDirectory()) { out.dirs.push(r); rec(r); }
      else if (d.isFile()) out.files.push({ rel: r, size: lstatSync(join(root, r)).size });
    }
  };
  rec("");
  return out;
}

function robocopy(src, dst) {
  // /XJ skips junctions + symlinks (handled below); /MT parallel; exit codes < 8 are success.
  const r = spawnSync("robocopy", [src, dst, "/E", "/XJ", "/MT:16", "/R:0", "/W:0", "/NFL", "/NDL", "/NJH", "/NJS", "/NP"], { encoding: "utf8", windowsHide: true });
  return r.status != null && r.status < 8;
}

function nodeCopy(src, dst, walk) {
  for (const d of walk.dirs) mkdirSync(join(dst, d), { recursive: true });
  for (const f of walk.files) copyFileSync(join(src, f.rel), join(dst, f.rel));
}

/** Resolve a link's target to an absolute path (relative targets are relative to the link's folder). */
function linkTarget(linkPath) {
  const t = readlinkSync(linkPath);
  return resolve(dirname(linkPath), t.replace(/^\\\\\?\\/, ""));
}

/**
 * Copy a prepared directory into an (empty or new) workspace. Returns what goes into meta.json `workspacePrep`.
 * Throws if the result would contain a link that leaves the workspace.
 */
export function prepareFromDir(src, ws, { method = WIN ? "robocopy" : "node" } = {}) {
  if (!existsSync(src) || !statSync(src).isDirectory()) throw new Error(`workspace.from is not a directory: ${src}`);
  const t0 = Date.now();
  src = realpathSync(src);
  mkdirSync(ws, { recursive: true });
  const walk = walkNoFollow(src);
  let used = method;
  if (method === "robocopy" && !robocopy(src, ws)) used = "node"; // robocopy missing or failed: fall back
  if (used === "node") nodeCopy(src, ws, walk);

  const links = { retargeted: 0, dereferenced: 0, broken: 0 };
  for (const l of walk.links) {
    const from = join(src, l.rel), to = join(ws, l.rel);
    let target;
    try { target = linkTarget(from); } catch { links.broken++; continue; }
    if (!existsSync(target)) { links.broken++; continue; }
    const isDir = statSync(target).isDirectory();
    mkdirSync(dirname(to), { recursive: true });
    rmSync(to, { recursive: true, force: true });
    if (inside(src, target)) {
      const newTarget = join(ws, relative(src, target));
      try {
        symlinkSync(newTarget, to, isDir ? (WIN ? "junction" : "dir") : "file");
        links.retargeted++;
        continue;
      } catch { /* file symlinks need Developer Mode on Windows: fall through to a real copy */ }
    }
    if (isDir) cpSync(target, to, { recursive: true, dereference: true });
    else copyFileSync(target, to);
    links.dereferenced++;
  }
  const copyMs = Date.now() - t0;

  // Verify: nothing in the workspace may point outside it.
  const t1 = Date.now();
  const got = walkNoFollow(ws);
  const escaping = [];
  for (const l of got.links) {
    let t;
    try { t = linkTarget(join(ws, l.rel)); } catch { continue; }
    if (!inside(ws, t)) escaping.push(`${l.rel} -> ${t}`);
  }
  if (escaping.length) throw new Error(`workspace has ${escaping.length} link(s) leaving it: ${escaping.slice(0, 3).join("; ")}`);
  const bytes = got.files.reduce((a, f) => a + f.size, 0);
  const srcFiles = walk.files.length;
  if (got.files.length < srcFiles) throw new Error(`workspace copy incomplete: ${got.files.length} of ${srcFiles} files`);
  return {
    method: used, files: got.files.length, dirs: got.dirs.length, bytes, links,
    copyMs, verifyMs: Date.now() - t1, gitHead: gitHead(src),
  };
}

/** HEAD commit of a prepared repo (provenance), or null. Reads files only; never runs git. */
export function gitHead(dir) {
  try {
    const head = readFileSync(join(dir, ".git", "HEAD"), "utf8").trim();
    const m = /^ref: (.+)$/.exec(head);
    if (!m) return /^[0-9a-f]{40}$/.test(head) ? head : null;
    const refFile = join(dir, ".git", ...m[1].split("/"));
    if (existsSync(refFile)) return readFileSync(refFile, "utf8").trim();
    const packed = join(dir, ".git", "packed-refs");
    if (existsSync(packed)) return readFileSync(packed, "utf8").split(/\r?\n/).find((l) => l.endsWith(` ${m[1]}`))?.split(" ")[0] || null;
  } catch { /* not a repo */ }
  return null;
}

/** Remove a workspace. Links are unlinked, never followed (fs.rm lstat()s every entry). */
export function removeWorkspace(ws) {
  rmSync(ws, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

// ------------------------------------------------------------------ artifact exclusion
const globRe = (g) => new RegExp(`^${g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");

/**
 * Compile `artifactExclude` patterns. A pattern without "/" matches any path segment by name (glob * ?);
 * a pattern with "/" (e.g. ".git/objects") matches a run of consecutive segments anywhere in the path.
 */
export function makeExcluder(patterns = []) {
  const pats = patterns.map((p) => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").split("/").map(globRe));
  return (rel) => {
    const segs = rel.replace(/\\/g, "/").split("/").filter(Boolean);
    return pats.some((p) => {
      for (let i = 0; i + p.length <= segs.length; i++) if (p.every((re, k) => re.test(segs[i + k]))) return true;
      return false;
    });
  };
}

/** Recursive copy with exclusions; links are copied as their content only if they stay inside `src`, else skipped. */
export function copyTreeExcluding(src, dst, exclude = []) {
  const skip = makeExcluder(exclude);
  const stats = { files: 0, bytes: 0, excluded: 0, linksSkipped: 0 };
  const rec = (rel) => {
    for (const d of readdirSync(join(src, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (skip(r)) { stats.excluded++; continue; }
      if (d.isSymbolicLink()) { stats.linksSkipped++; continue; } // a link is never collected (it would point into the workspace)
      if (d.isDirectory()) { mkdirSync(join(dst, r), { recursive: true }); rec(r); }
      else if (d.isFile() && !existsSync(join(dst, r))) { // like cpSync(force:false): an artifact already collected wins
        copyFileSync(join(src, r), join(dst, r));
        stats.files++;
        stats.bytes += lstatSync(join(dst, r)).size;
      }
    }
  };
  mkdirSync(dst, { recursive: true });
  rec("");
  return stats;
}

/** Total size of a directory (no link following). */
export function dirSize(dir) {
  if (!existsSync(dir)) return { files: 0, bytes: 0 };
  const w = walkNoFollow(dir);
  return { files: w.files.length, bytes: w.files.reduce((a, f) => a + f.size, 0) };
}
