// dsh-git launch 层：在 macOS 上打开 Terminal / iTerm 并 cd 到仓库根目录，
// 或在终端里启动交互式代理 app（codex / claude / antigravity / opencode）。
//
// 移植自 gmc（gmc/lib/web.js 的 openTerminalAtRepository / openAgentAtRepository，
// 以及 gmc/lib/agent.js 的 interactiveInvocation）。所有命令执行都通过
// osascript 驱动系统 Terminal / iTerm，仅支持 macOS。
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import gmc from "gmc/lib/git.js";
import agent from "gmc/lib/agent.js";

/** 允许通过快捷按钮启动的交互式代理 app。 */
export const SUPPORTED_AGENTS = ["codex", "claude", "antigravity", "opencode"];

/** 带状态码的错误，路由层转成对应 HTTP 响应。 */
export class LaunchError extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function shellQuote(value) {
  const q = "'";
  return q + String(value).replace(/'/g, q + "\\" + q + q) + q;
}

function appleScriptString(value) {
  return JSON.stringify(String(value));
}

function hasMacApplication(appName) {
  const result = spawnSync("osascript", ["-e", "id of application " + appleScriptString(appName)], { encoding: "utf8" });
  return !result.error && result.status === 0;
}

function runTerminalAppleScript(script, fallbackMessage) {
  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const message = (result.stderr || result.stdout || (result.error && result.error.message) || "osascript failed").trim();
    throw new LaunchError(message || fallbackMessage);
  }
}

function openITermAtPath(repoRoot, command) {
  const script = [
    'tell application "iTerm"',
    "  activate",
    "  create window with default profile",
    "  tell current session of current window",
    "    write text " + appleScriptString(command),
    "  end tell",
    "end tell"
  ].join("\n");
  runTerminalAppleScript(script, "Failed to open iTerm.");
  return { status: "ok", terminal: "iTerm", path: repoRoot };
}

function openTerminalAppAtPath(repoRoot, command) {
  const script = [
    'tell application "Terminal"',
    "  do script " + appleScriptString(command),
    "  activate",
    "end tell"
  ].join("\n");
  runTerminalAppleScript(script, "Failed to open Terminal.");
  return { status: "ok", terminal: "Terminal", path: repoRoot };
}

/** 打开 Terminal（优先 iTerm）并 cd 到目标目录。 */
function openTerminalApp(repoRoot, command) {
  if (hasMacApplication("iTerm")) {
    try {
      return openITermAtPath(repoRoot, command);
    } catch {
      return openTerminalAppAtPath(repoRoot, command);
    }
  }
  return openTerminalAppAtPath(repoRoot, command);
}

/** 定位仓库根目录；不在 git 管理下时回退到目录本身（非 repo 目录也能打开终端）。 */
function resolveRoot(root) {
  try {
    return gmc.repoRoot(root);
  } catch {
    return root;
  }
}

function requireDarwin(what) {
  if (process.platform !== "darwin") {
    throw new LaunchError(`Opening ${what} is only supported on macOS.`);
  }
}

function requireDir(repoRoot) {
  if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
    throw new LaunchError(`Path does not exist or is not a directory: ${repoRoot}`);
  }
}

/** 在终端中打开仓库（cd 到仓库根目录）。 */
export function openTerminalAtRepository(root) {
  requireDarwin("Terminal");
  const repoRoot = resolveRoot(root);
  requireDir(repoRoot);
  return openTerminalApp(repoRoot, "cd " + shellQuote(repoRoot));
}

/** 在终端里启动交互式代理 app。agent 必须是 SUPPORTED_AGENTS 之一。 */
export function openAgentAtRepository(root, selectedAgent) {
  requireDarwin("Agent");
  if (typeof selectedAgent !== "string" || SUPPORTED_AGENTS.indexOf(selectedAgent) < 0) {
    throw new LaunchError(`Unsupported agent: ${selectedAgent}. Use ${SUPPORTED_AGENTS.join(", ")}.`);
  }
  const repoRoot = resolveRoot(root);
  requireDir(repoRoot);

  let invocation;
  try {
    invocation = agent.interactiveInvocation(selectedAgent, repoRoot);
  } catch (error) {
    throw new LaunchError(error.message);
  }
  let command = "cd " + shellQuote(repoRoot) + " && " + shellQuote(invocation.command);
  for (const arg of invocation.args) command += " " + shellQuote(arg);

  return openTerminalApp(repoRoot, command);
}

/** 探测项目类型并返回适用的 IDE 信息（Xcode / Android Studio / VS Code）。 */
export function detectProjectType(root) {
  try {
    const repoRoot = resolveRoot(root);
    if (!existsSync(repoRoot) || !statSync(repoRoot).isDirectory()) {
      return { type: "other", ide: "code", ideLabel: "VS Code" };
    }
    const files = existsSync(repoRoot) ? readdirSync(repoRoot) : [];
    const xcodeMatch = files.some((name) => /\.xcodeproj$/i.test(name) || /\.xcworkspace$/i.test(name));
    if (xcodeMatch) {
      return { type: "ios", ide: "xcode", ideLabel: "Xcode" };
    }
    const hasRootGradle = existsSync(join(repoRoot, "build.gradle")) || existsSync(join(repoRoot, "build.gradle.kts"));
    const hasAppGradle = existsSync(join(repoRoot, "app", "build.gradle")) || existsSync(join(repoRoot, "app", "build.gradle.kts"));
    if (hasRootGradle || hasAppGradle) {
      return { type: "android", ide: "android-studio", ideLabel: "Android Studio" };
    }
    return { type: "other", ide: "code", ideLabel: "VS Code" };
  } catch {
    return { type: "other", ide: "code", ideLabel: "VS Code" };
  }
}

/** 在适用的 IDE 中打开项目。 */
export function openIdeAtRepository(root) {
  requireDarwin("IDE");
  const repoRoot = resolveRoot(root);
  requireDir(repoRoot);
  const project = detectProjectType(repoRoot);
  let result;
  const env = Object.assign({}, process.env);

  switch (project.ide) {
    case "xcode": {
      const files = readdirSync(repoRoot).filter((name) => /\.xcworkspace$/i.test(name) || /\.xcodeproj$/i.test(name));
      const ws = files.filter((name) => /\.xcworkspace$/i.test(name));
      const pbx = files.filter((name) => /\.xcodeproj$/i.test(name));
      const target = (ws.length ? ws : pbx)[0];
      if (target) {
        result = spawnSync("open", [join(repoRoot, target)], { env, encoding: "utf8" });
      } else {
        throw new LaunchError("No Xcode project file found.");
      }
      break;
    }
    case "android-studio": {
      result = spawnSync("open", ["-b", "com.google.android.studio", repoRoot], { env, encoding: "utf8" });
      if (result.error || result.status !== 0) {
        result = spawnSync("open", ["-a", "Android Studio", repoRoot], { env, encoding: "utf8" });
      }
      if (result.error || result.status !== 0) {
        result = spawnSync("studio", [repoRoot], { cwd: repoRoot, env, encoding: "utf8" });
      }
      break;
    }
    case "code":
    default: {
      result = spawnSync("code", [repoRoot], { cwd: repoRoot, env, encoding: "utf8" });
      if (result.error || result.status !== 0) {
        result = spawnSync("open", ["-b", "com.microsoft.VSCode", repoRoot], { env, encoding: "utf8" });
      }
      if (result.error || result.status !== 0) {
        result = spawnSync("open", ["-a", "Visual Studio Code", repoRoot], { env, encoding: "utf8" });
      }
      if (result.error || result.status !== 0) {
        result = spawnSync("open", [repoRoot], { env, encoding: "utf8" });
      }
      break;
    }
  }

  if (result.error || result.status !== 0) {
    const message = (result.stderr || result.stdout || (result.error && result.error.message) || "").trim();
    throw new LaunchError(message || `Failed to open in ${project.ideLabel}.`);
  }
  return { status: "ok", ide: project.ide, ideLabel: project.ideLabel, path: repoRoot };
}

/** 在 Finder 中打开目录（点击 Git tab 顶部路径时使用）。 */
export function openFinderAtPath(dir) {
  requireDarwin("Finder");
  requireDir(dir);
  const result = spawnSync("open", [dir], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const message = (result.stderr || result.stdout || (result.error && result.error.message) || "open failed").trim();
    throw new LaunchError(message || "Failed to open in Finder.");
  }
  return { status: "ok", path: dir };
}

