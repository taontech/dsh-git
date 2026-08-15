// dsh-git 数据层：所有 git 命令执行都委托给 gmc（lib/git.js 的 runGit），
// 这里只做解析与组合，输出给前端 JSON API。
import gmc from "gmc/lib/git.js";
import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, sep, basename, extname, resolve } from "node:path";

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

/** 工作区所有文件列表：包含状态标记、大小等。 */
export function collectWorkspaceFiles(cwd) {
  const statusRes = collectStatus(cwd);
  const statusMap = new Map();
  for (const f of statusRes.files) {
    statusMap.set(f.gitPath || f.path, f);
  }

  if (!isRepo(cwd)) {
    return { isRepo: false, files: statusRes.files };
  }

  const root = gmc.repoRoot(cwd);
  const r = runGit(["ls-files", "-co", "--exclude-standard", "-z"], { cwd, allowFailure: true });
  const fileSet = new Set();
  if (r.status === 0 && r.stdout) {
    for (const p of String(r.stdout).split("\0")) {
      if (p.trim()) fileSet.add(p);
    }
  }

  // 确保 status 中的改动文件也包含（比如删除的文件）
  for (const [gitPath] of statusMap) {
    fileSet.add(gitPath);
  }

  const files = [];
  for (const relPath of fileSet) {
    const st = statusMap.get(relPath);
    let size = null;
    try {
      const full = join(root, relPath);
      if (existsSync(full)) {
        const stats = statSync(full);
        if (stats.isFile()) size = stats.size;
      }
    } catch { /* ignore */ }

    files.push({
      path: relPath,
      gitPath: relPath,
      name: basename(relPath),
      size,
      status: st ? st.status : null,
      index: st ? st.index : " ",
      worktree: st ? st.worktree : " "
    });
  }

  files.sort((a, b) => a.path.localeCompare(b.path));
  return { isRepo: true, root, files };
}

function isBinaryBuffer(buffer) {
  if (!buffer || !buffer.length) return false;
  const sampleSize = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleSize; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function mimeTypeForPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".json": "application/json",
    ".md": "text/markdown",
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".cjs": "application/javascript",
    ".ts": "application/typescript",
    ".html": "text/html",
    ".css": "text/css"
  };
  return types[ext] || "text/plain; charset=utf-8";
}

function languageForPath(filePath) {
  const ext = extname(filePath).toLowerCase().replace(/^\./, "");
  const map = {
    js: "JavaScript",
    mjs: "JavaScript",
    cjs: "JavaScript",
    jsx: "JSX",
    ts: "TypeScript",
    tsx: "TSX",
    json: "JSON",
    md: "Markdown",
    css: "CSS",
    scss: "SCSS",
    less: "Less",
    html: "HTML",
    sh: "Shell",
    bash: "Shell",
    zsh: "Shell",
    yml: "YAML",
    yaml: "YAML",
    py: "Python",
    go: "Go",
    rs: "Rust",
    java: "Java",
    c: "C",
    cpp: "C++",
    h: "C Header",
    hpp: "C++ Header",
    swift: "Swift",
    kt: "Kotlin",
    sql: "SQL",
    xml: "XML",
    toml: "TOML"
  };
  const base = basename(filePath).toLowerCase();
  if (base === "dockerfile") return "Dockerfile";
  if (base === ".gitignore") return "Git Ignore";
  return map[ext] || (ext ? ext.toUpperCase() : "Text");
}

/** 读取工作区单个文件内容（复用 gmc 文件预览格式：line, size, language, mime, image dataUrl）。 */
export function collectFileContent(cwd, filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Missing file path");
  }
  const cleanPath = filePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!cleanPath || cleanPath.includes("\0")) {
    throw new Error("Invalid file path");
  }

  const root = isRepo(cwd) ? gmc.repoRoot(cwd) : cwd;
  const fullPath = resolve(root, cleanPath);
  if (!fullPath.startsWith(root) && fullPath !== root) {
    throw new Error("Access denied: path outside repository");
  }

  let buffer = null;
  if (existsSync(fullPath)) {
    buffer = readFileSync(fullPath);
  } else if (isRepo(cwd)) {
    const r = runGit(["show", `HEAD:${cleanPath}`], { cwd: root, allowFailure: true });
    if (r.status === 0 && r.stdout !== null) {
      buffer = Buffer.from(r.stdout);
    }
  }

  if (!buffer) {
    throw new Error(`File not found: ${cleanPath}`);
  }

  const size = buffer.length;
  const mime = mimeTypeForPath(cleanPath);
  const language = languageForPath(cleanPath);
  const maxReadableBytes = 1024 * 1024;
  const maxBinaryBytes = 10 * 1024 * 1024;
  const binary = isBinaryBuffer(buffer);

  let dataUrl = "";
  if (binary) {
    if (mime.startsWith("image/") && size <= maxBinaryBytes) {
      dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    }
    return {
      path: cleanPath,
      name: basename(cleanPath),
      size,
      mime,
      language,
      binary: true,
      truncated: false,
      content: "",
      dataUrl
    };
  }

  const truncated = buffer.length > maxReadableBytes;
  const content = buffer.slice(0, maxReadableBytes).toString("utf8");

  return {
    path: cleanPath,
    name: basename(cleanPath),
    size,
    mime,
    language,
    binary: false,
    truncated,
    content,
    dataUrl: ""
  };
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

/** 提交详情：获取单个 commit 的完整哈希、提交信息和修改文件概况（git show --stat）。 */
export function collectCommitDetail(cwd, hash) {
  if (!isRepo(cwd)) throw new Error("Not a git repository");
  if (!hash || typeof hash !== "string" || !/^[0-9a-fA-F]{4,40}$/.test(hash.trim())) {
    throw new Error("Invalid commit hash");
  }
  const cleanHash = hash.trim();
  const meta = runGit(
    ["show", "-s", "--pretty=format:%H%x00%h%x00%an%x00%ae%x00%ad%x00%s%x00%b", "--date=format:%Y-%m-%d %H:%M:%S", cleanHash],
    { cwd, allowFailure: true }
  );
  if (meta.status !== 0 || !meta.stdout) {
    throw new Error(`Commit not found: ${cleanHash}`);
  }
  const [fullHash, shortHash, author, email, date, subject, body] = String(meta.stdout).split("\0");
  const stat = runGit(["show", "--stat", "--format=", cleanHash], { cwd, allowFailure: true });
  const statText = stat.status === 0 ? String(stat.stdout ?? "").trim() : "";
  return {
    hash: fullHash,
    shortHash: shortHash || fullHash.slice(0, 7),
    author,
    email,
    date,
    subject,
    body: (body || "").trim(),
    stat: statText
  };
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
