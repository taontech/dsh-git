// dsh-git 数据层：所有 git 命令执行都委托给 gmc（lib/git.js 的 runGit），
// 这里只做解析与组合，输出给前端 JSON API。
import gmc from "gmc/lib/git.js";
import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

const { runGit } = gmc;

/** 目录是否在一个 git 工作树内。 */
export function isRepo(cwd) {
  const r = runGit(["rev-parse", "--is-inside-work-tree"], { cwd, allowFailure: true });
  return r.status === 0 && String(r.stdout ?? "").trim() === "true";
}

/** Repo 概况：分支、远端、ahead/behind、最后提交、dirty 标记。 */
export function collectInfo(cwd) {
  if (!isRepo(cwd)) return { cwd, isRepo: false };
  let root = cwd;
  let branch = "";
  let remoteUrl = null;
  let ahead = null;
  let behind = null;
  let lastCommit = null;
  let isDirty = false;
  try {
    root = gmc.repoRoot(cwd);
  } catch { /* not a repo root from here */ }
  try {
    branch = gmc.currentBranch(cwd);
  } catch { /* detached HEAD */ }
  try {
    remoteUrl = gmc.originUrl(cwd);
  } catch { /* no remote */ }
  const ab = runGit(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, allowFailure: true });
  if (ab.status === 0) {
    const counts = String(ab.stdout ?? "").trim().split(/\s+/);
    ahead = Number(counts[0]);
    behind = Number(counts[1]);
  }
  const lc = runGit(
    ["log", "-1", "--pretty=format:%H%x00%h%x00%an%x00%ae%x00%ad%x00%s", "--date=format:%Y-%m-%d %H:%M:%S"],
    { cwd, allowFailure: true }
  );
  if (lc.status === 0 && lc.stdout) {
    const [hash, shortHash, author, email, date, subject] = String(lc.stdout).split("\0");
    lastCommit = { hash, shortHash, author, email, date, subject };
  }
  const dirty = runGit(["status", "--porcelain"], { cwd, allowFailure: true });
  isDirty = dirty.status === 0 && String(dirty.stdout ?? "").trim() !== "";
  return { cwd, isRepo: true, root, branch, remoteUrl, ahead, behind, lastCommit, isDirty };
}

/** 文件列表 + 修改标记：repo 内用 git status --porcelain -z，非 repo 退化为 fs 遍历。 */
export function collectStatus(cwd) {
  if (!isRepo(cwd)) return { isRepo: false, files: listFiles(cwd) };
  const r = runGit(["status", "--porcelain=v1", "-z"], { cwd, allowFailure: true });
  const files = [];
  if (r.status === 0 && r.stdout) {
    const parts = String(r.stdout).split("\0");
    for (let i = 0; i < parts.length; i++) {
      const entry = parts[i];
      if (entry === "" || entry.startsWith("## ")) continue;
      const xy = entry.slice(0, 2);
      let path = entry.slice(3);
      if (xy[1] === "R" || xy[1] === "C") path = `${path} -> ${parts[++i] ?? ""}`;
      files.push({ path, index: xy[0], worktree: xy[1], status: xy });
    }
  }
  return { isRepo: true, root: gmc.repoRoot(cwd), files };
}

/** 提交历史：最近 count 条。 */
export function collectLog(cwd, count = 30) {
  if (!isRepo(cwd)) return [];
  const r = runGit(
    ["log", `-${count}`, "-z", "--pretty=format:%H%x00%h%x00%an%x00%ae%x00%ad%x00%s", "--date=format:%Y-%m-%d %H:%M:%S"],
    { cwd, allowFailure: true }
  );
  if (r.status !== 0 || !r.stdout) return [];
  const parts = String(r.stdout).split("\0");
  const commits = [];
  for (let i = 0; i + 5 < parts.length; i += 6) {
    commits.push({
      hash: parts[i],
      shortHash: parts[i + 1],
      author: parts[i + 2],
      email: parts[i + 3],
      date: parts[i + 4],
      subject: parts[i + 5]
    });
  }
  return commits;
}

/** 分支列表 + ASCII 提交图（git log --graph）。 */
export function collectBranches(cwd) {
  if (!isRepo(cwd)) return { branches: [], graph: "" };
  const r = runGit(
    ["for-each-ref", "--format=%(refname:short)%09%(HEAD)%09%(objectname:short)%09%(upstream:short)", "refs/heads", "refs/remotes"],
    { cwd, allowFailure: true }
  );
  const branches = [];
  if (r.status === 0 && r.stdout) {
    for (const line of String(r.stdout).split("\n")) {
      if (!line.trim()) continue;
      const [name, head, sha, upstream] = line.split("\t");
      branches.push({ name, current: head === "*", sha, upstream: upstream || null });
    }
  }
  const graph = runGit(["log", "--graph", "--oneline", "--all", "-40"], { cwd, allowFailure: true });
  return { branches, graph: graph.status === 0 ? String(graph.stdout ?? "") : "" };
}

/** 非 repo 场景的文件列表（fs 遍历，跳过常见大目录）。 */
export function listFiles(cwd, { limit = 1000, maxDepth = 6 } = {}) {
  if (!isAbsolute(cwd) || !existsSync(cwd)) return [];
  const SKIP = new Set(["node_modules", ".git", ".dsh", ".pnpm-store", ".dsh-home", "dist", ".venv", "__pycache__"]);
  const files = [];
  const walk = (dir, depth) => {
    if (files.length >= limit || depth > maxDepth) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= limit) return;
      if (SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      try {
        if (entry.isDirectory()) walk(full, depth + 1);
        else files.push({ path: relative(cwd, full).split(sep).join("/"), type: "file", size: statSync(full).size });
      } catch { /* unreadable entry */ }
    }
  };
  walk(cwd, 0);
  return files;
}

/** git init。 */
export function initRepo(cwd) {
  const r = runGit(["init"], { cwd, allowFailure: true });
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout || "git init failed").trim());
  return { ok: true, root: gmc.repoRoot(cwd) };
}
