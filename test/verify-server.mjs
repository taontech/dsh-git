// dsh-git 数据层单测：不起 DSH，直接测 gmc 封装 + 解析逻辑。
// 运行：node test/verify-server.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectInfo,
  collectStatus,
  collectLog,
  collectBranches,
  listFiles,
  initRepo,
  isRepo
} from "../lib/git-data.js";

let pass = 0;
function check(label, cond) {
  if (!cond) throw new Error("FAIL: " + label);
  console.log("  ✓ " + label);
  pass++;
}

const tmp = mkdtempSync(join(tmpdir(), "dsh-git-test-"));
const repoDir = join(tmp, "repo");
const plainDir = join(tmp, "plain");

// ── 造一个带提交的 git 仓库 ────────────────────────────────────────────
mkdirSync(join(repoDir, "src"), { recursive: true });
writeFileSync(join(repoDir, "README.md"), "# demo\n");
writeFileSync(join(repoDir, "src", "a.js"), "console.log(1)\n");
execFileSync("git", ["init", "-b", "main"], { cwd: repoDir });
execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });
execFileSync("git", ["config", "user.name", "Tester"], { cwd: repoDir });
execFileSync("git", ["add", "."], { cwd: repoDir });
execFileSync("git", ["commit", "-m", "first commit"], { cwd: repoDir });
// 修改一个文件 + 新增一个未跟踪文件 → 工作区有变化
writeFileSync(join(repoDir, "src", "a.js"), "console.log(2)\n");
writeFileSync(join(repoDir, "notes.txt"), "untracked\n");

// ── 非 git 目录 ────────────────────────────────────────────────────────
mkdirSync(join(plainDir, "docs"), { recursive: true });
writeFileSync(join(plainDir, "index.html"), "<h1>hi</h1>\n");
writeFileSync(join(plainDir, "docs", "guide.md"), "# guide\n");

try {
  console.log("── repo 场景 ──");
  check("isRepo(repo) === true", isRepo(repoDir) === true);
  check("isRepo(plain) === false", isRepo(plainDir) === false);

  const info = collectInfo(repoDir);
  check("info.isRepo", info.isRepo === true);
  check("info.root 正确", info.root === realpathSync(repoDir));
  check("info.branch === main", info.branch === "main");
  check("info.isDirty（有修改）", info.isDirty === true);
  check("info.lastCommit.subject", info.lastCommit?.subject === "first commit");

  const status = collectStatus(repoDir);
  check("status.files 有 2 项（1 改 + 1 未跟踪）", status.files.length === 2);
  const modified = status.files.find((f) => f.path === "src/a.js");
  check("src/a.js 标记为 M", modified !== void 0 && (modified.index === "M" || modified.worktree === "M"));
  const untracked = status.files.find((f) => f.path === "notes.txt");
  check("notes.txt 标记为 ??", untracked !== void 0 && untracked.status === "??");

  const log = collectLog(repoDir);
  check("log 有 1 条提交", log.length === 1 && log[0].subject === "first commit" && log[0].hash.length === 40);

  const branches = collectBranches(repoDir);
  check("branches 含 main 且为当前分支", branches.branches.some((b) => b.name === "main" && b.current));
  check("branches.graph 非空", branches.graph.includes("first commit"));

  console.log("── 非 repo 场景 ──");
  const plainStatus = collectStatus(plainDir);
  check("plainStatus.isRepo === false", plainStatus.isRepo === false);
  check("plain 文件列表含 index.html 与 docs/guide.md", plainStatus.files.length === 2);
  const plainInfo = collectInfo(plainDir);
  check("plainInfo.isRepo === false", plainInfo.isRepo === false);
  check("listFiles 跳过/限制正常", listFiles(plainDir).length === 2);

  console.log("── git init 场景 ──");
  const initResult = initRepo(plainDir);
  check("initRepo ok 且返回 root", initResult.ok === true && initResult.root === realpathSync(plainDir));
  check("init 后 isRepo(plain) === true", isRepo(plainDir) === true);

  console.log(`\n✅ 全部 ${pass} 项检查通过`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
