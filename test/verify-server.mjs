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
  isRepo,
  stageFiles,
  unstageFiles,
  commit,
  checkoutBranch,
  collectCommitDetail,
  collectWorkspaceFiles,
  collectFileContent
} from "../lib/git-data.js";
import { detectProjectType } from "../lib/launch.js";

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

  console.log("── git 操作场景（stage/unstage/commit/checkout）──");
  // 暂存两个改动文件
  const stageResult = stageFiles(repoDir, ["src/a.js", "notes.txt"]);
  check("stageFiles 返回 staged 2 个", stageResult.ok && stageResult.staged.length === 2);
  let st = collectStatus(repoDir);
  check("stage 后 index 变为 M/A（已暂存）", st.files.every((f) => f.index !== " " && f.index !== "?"));
  // 取消暂存一个
  const unstageResult = unstageFiles(repoDir, ["notes.txt"]);
  check("unstageFiles 返回 unstaged 1 个", unstageResult.ok && unstageResult.unstaged.length === 1);
  st = collectStatus(repoDir);
  const notes = st.files.find((f) => f.path === "notes.txt");
  check("unstage 后 notes.txt 回到 ??", notes !== void 0 && notes.status === "??");
  // 非法路径校验
  let rejected = false;
  try {
    stageFiles(repoDir, ["nonexistent.txt"]);
  } catch {
    rejected = true;
  }
  check("非法路径被拒绝", rejected === true);
  // 提交已暂存的 src/a.js
  const commitResult = commit(repoDir, "feat: update app");
  check("commit 成功且返回 shortHash", commitResult.ok === true && typeof commitResult.shortHash === "string" && commitResult.shortHash.length >= 7);
  const logAfter = collectLog(repoDir);
  // 空消息默认作为 gmc 提交
  stageFiles(repoDir, ["notes.txt"]);
  const gmcCommitResult = commit(repoDir, "   ");
  check("空提交消息自动使用 gmc 提交", gmcCommitResult.ok === true && typeof gmcCommitResult.shortHash === "string");
  const logAfterGmc = collectLog(repoDir);
  check("log 现在有 3 条提交", logAfterGmc.length === 3);
  // 分支切换：新建 feature 分支再切回
  execFileSync("git", ["switch", "-c", "feature"], { cwd: repoDir });
  check("collectBranches 含 feature 且为当前", collectBranches(repoDir).branches.some((b) => b.name === "feature" && b.current));
  const switchResult = checkoutBranch(repoDir, "main");
  check("checkoutBranch 切回 main", switchResult.ok === true && switchResult.branch === "main");
  check("切回后 current 是 main", collectBranches(repoDir).branches.find((b) => b.name === "main").current === true);
  // 不存在的分支被拒绝
  rejected = false;
  try {
    checkoutBranch(repoDir, "no-such-branch");
  } catch {
    rejected = true;
  }
  check("不存在分支被拒绝", rejected === true);

  console.log("── 提交详情场景 ──");
  const detail = collectCommitDetail(repoDir, logAfter[0].hash);
  check("collectCommitDetail 返回完整哈希", detail.hash === logAfter[0].hash);
  check("collectCommitDetail 返回 subject", detail.subject === "feat: update app");
  check("collectCommitDetail 返回 stat 包含改动文件", detail.stat.includes("src/a.js"));

  console.log("── 工作区文件与文件内容查看场景 ──");
  const wsFiles = collectWorkspaceFiles(repoDir);
  check("collectWorkspaceFiles 返回所有文件", wsFiles.files.length >= 3);
  check("wsFiles 包含 README.md 与 src/a.js", wsFiles.files.some((f) => f.path === "README.md") && wsFiles.files.some((f) => f.path === "src/a.js"));
  
  const fileData = collectFileContent(repoDir, "src/a.js");
  check("collectFileContent 返回 content", fileData.content.includes("console.log"));
  check("collectFileContent 返回 language=JavaScript", fileData.language === "JavaScript");
  check("collectFileContent binary === false", fileData.binary === false);

  // 路径逃逸检测
  let escapeDenied = false;
  try {
    collectFileContent(repoDir, "../../../etc/passwd");
  } catch {
    escapeDenied = true;
  }
  check("路径逃逸被安全拦截", escapeDenied === true);

  console.log("── 项目类型探测场景 ──");
  const ideDefault = detectProjectType(repoDir);
  check("默认项目探测为 VS Code", ideDefault.ide === "code");
  // 模拟 xcode
  writeFileSync(join(repoDir, "App.xcodeproj"), "");
  const ideXcode = detectProjectType(repoDir);
  check("带 xcodeproj 探测为 Xcode", ideXcode.ide === "xcode" && ideXcode.ideLabel === "Xcode");

  console.log(`\n✅ 全部 ${pass} 项检查通过`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
