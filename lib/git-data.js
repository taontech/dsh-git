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
      let gitPath = path;
      if (xy[1] === "R" || xy[1] === "C") {
        gitPath = parts[++i] ?? path;
        path = `${path} -> ${gitPath}`;
      }
      files.push({ path, gitPath, index: xy[0], worktree: xy[1], status: xy });
    }
  }
  return { isRepo: true, root: gmc.repoRoot(cwd), files };
}

/** 贡献日历：最近一年每天提交次数（date -> count）。 */
export function collectContributions(cwd) {
  if (!isRepo(cwd)) return {};
  const r = runGit(
    ["log", "--all", "--since=1.year", "--format=%ad", "--date=short"],
    { cwd, allowFailure: true }
  );
  if (r.status !== 0) return {};
  const counts = {};
  for (const line of String(r.stdout ?? "").split(/\r?\n/)) {
    const day = line.trim();
    if (day) counts[day] = (counts[day] || 0) + 1;
  }
  return counts;
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

// ── git 操作（stage / unstage / commit / push / pull / checkout）──────────
// 安全校验原则：路径必须是当前 status 里的真实条目（用 gitPath），
// 分支必须存在于分支列表；git 命令执行仍全部走 gmc 的 runGit。

class GitActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** 从当前 status 构建 {staged, worktree} 两个按 gitPath 索引的集合。 */
function statusIndex(cwd) {
  const { files } = collectStatus(cwd);
  const staged = new Set();
  const worktree = new Set();
  for (const file of files) {
    if (file.index !== " " && file.index !== "?") staged.add(file.gitPath);
    if (file.worktree !== " ") worktree.add(file.gitPath);
  }
  return { staged, worktree };
}

/**
* 校验并规范化 paths 参数：非空字符串数组、无 NUL、且都在允许集合内。
* @returns 清洗后的路径数组（去重，保序）。
*/
function validatePaths(paths, allowed, description) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new GitActionError(`Select at least one ${description}.`);
  }
  const seen = new Set();
  const cleaned = [];
  for (const raw of paths) {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "" || value.includes("\0")) {
      throw new GitActionError(`Invalid ${description} path.`);
    }
    if (allowed.has(value) && !seen.has(value)) {
      seen.add(value);
      cleaned.push(value);
    }
  }
  if (cleaned.length === 0) {
    throw new GitActionError(`No valid ${description} in the selection.`);
  }
  return cleaned;
}

/** 暂存：git add -A -- <paths>（只允许当前有工作区改动的文件）。 */
export function stageFiles(cwd, paths) {
  const { worktree } = statusIndex(cwd);
  const selected = validatePaths(paths, worktree, "modified file to stage");
  const r = runGit(["add", "-A", "--", ...selected], { cwd, allowFailure: true });
  if (r.status !== 0) throw new GitActionError(`Failed to stage files: ${String(r.stderr || r.stdout || "").trim()}`);
  return { ok: true, staged: selected };
}

/** 取消暂存：git restore --staged -- <paths>（只允许已暂存的文件）。 */
export function unstageFiles(cwd, paths) {
  const { staged } = statusIndex(cwd);
  const selected = validatePaths(paths, staged, "staged file to unstage");
  const r = runGit(["restore", "--staged", "--", ...selected], { cwd, allowFailure: true });
  if (r.status !== 0) throw new GitActionError(`Failed to unstage files: ${String(r.stderr || r.stdout || "").trim()}`);
  return { ok: true, unstaged: selected };
}

/** 提交已暂存内容：git commit -m <message>。 */
export function commit(cwd, message) {
  if (typeof message !== "string" || message.trim() === "" || message.includes("\0")) {
    throw new GitActionError("Commit message is required.");
  }
  const clean = message.trim();
  if (clean.length > 5000) throw new GitActionError("Commit message too long (max 5000 chars).");
  const r = runGit(["commit", "-m", clean], { cwd, allowFailure: true });
  if (r.status !== 0) {
    throw new GitActionError(String(r.stderr || r.stdout || "git commit failed").trim());
  }
  const output = String(r.stdout || r.stderr || "").trim();
  const hashMatch = output.match(/\[([^\]]+)\s+([0-9a-f]{7,40})\]/);
  return { ok: true, output, branch: hashMatch?.[1] ?? null, shortHash: hashMatch?.[2] ?? null };
}

/** 推送：git push。 */
export function push(cwd) {
  const r = runGit(["push"], { cwd, allowFailure: true });
  if (r.status !== 0) throw new GitActionError(String(r.stderr || r.stdout || "git push failed").trim());
  return { ok: true, output: String(r.stdout || r.stderr || "").trim() };
}

/** 拉取：git pull。 */
export function pull(cwd) {
  const r = runGit(["pull"], { cwd, allowFailure: true });
  if (r.status !== 0) throw new GitActionError(String(r.stderr || r.stdout || "git pull failed").trim());
  return { ok: true, output: String(r.stdout || r.stderr || "").trim() };
}

/** 切换分支：git switch <branch>（分支必须存在于分支列表）。 */
export function checkoutBranch(cwd, branch) {
  if (typeof branch !== "string" || branch.trim() === "" || branch.includes("\0")) {
    throw new GitActionError("Branch name is required.");
  }
  const name = branch.trim();
  const { branches } = collectBranches(cwd);
  const found = branches.find((b) => b.name === name);
  if (!found) throw new GitActionError(`Branch not found: ${name}`);
  if (found.current) return { ok: true, alreadyCurrent: true };
  const r = runGit(["switch", name], { cwd, allowFailure: true });
  if (r.status !== 0) throw new GitActionError(String(r.stderr || r.stdout || "git switch failed").trim());
  return { ok: true, branch: name, output: String(r.stdout || "").trim() };
}
