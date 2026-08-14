// dsh-git server 插件：把 gmc 的 git 能力暴露为 DSH webServer 上的 JSON API。
// 路由前缀 /dsh-git，client 端 Git tab 通过同源 fetch 调用。
import z from "@deepseek-ai/schemastery";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import * as git from "./git-data.js";

const name = "dsh-git";
const inject = ["webServer"];
const Config = z.object({}).default({});

/** 带状态码的错误，路由层转成对应 HTTP 响应。 */
class HttpError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy(new Error("dsh-git: request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new HttpError(400, "dsh-git: invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/** cwd 参数必须是存在的绝对路径。 */
function requireCwd(raw) {
  if (typeof raw !== "string" || raw === "" || !isAbsolute(raw)) {
    throw new HttpError(400, "dsh-git: cwd must be an absolute path");
  }
  if (!existsSync(raw)) throw new HttpError(404, `dsh-git: path does not exist: ${raw}`);
  return raw;
}

async function handle(req, res) {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;
    const cwdRaw = url.searchParams.get("cwd") ?? "";
    if (path === "/dsh-git/health") return sendJson(res, 200, { ok: true });
    if (path === "/dsh-git/info") return sendJson(res, 200, git.collectInfo(requireCwd(cwdRaw)));
    if (path === "/dsh-git/status") return sendJson(res, 200, git.collectStatus(requireCwd(cwdRaw)));
    if (path === "/dsh-git/log") return sendJson(res, 200, { commits: git.collectLog(requireCwd(cwdRaw)) });
    if (path === "/dsh-git/branches") return sendJson(res, 200, git.collectBranches(requireCwd(cwdRaw)));
    if (path === "/dsh-git/init" && req.method === "POST") {
      const body = await readJsonBody(req);
      const cwd = requireCwd(typeof body.cwd === "string" ? body.cwd : "");
      return sendJson(res, 200, git.initRepo(cwd));
    }
    // ── git 操作端点（全部 POST）────────────────────────────────────
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const cwd = requireCwd(typeof body.cwd === "string" ? body.cwd : "");
      if (path === "/dsh-git/stage") return sendJson(res, 200, git.stageFiles(cwd, body.paths));
      if (path === "/dsh-git/unstage") return sendJson(res, 200, git.unstageFiles(cwd, body.paths));
      if (path === "/dsh-git/commit") return sendJson(res, 200, git.commit(cwd, body.message));
      if (path === "/dsh-git/push") return sendJson(res, 200, git.push(cwd));
      if (path === "/dsh-git/pull") return sendJson(res, 200, git.pull(cwd));
      if (path === "/dsh-git/checkout") return sendJson(res, 200, git.checkoutBranch(cwd, body.branch));
    }
    sendJson(res, 404, { error: `dsh-git: unknown endpoint ${path}` });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    sendJson(res, status, { error: err instanceof Error ? err.message : String(err) });
  }
}

function apply(ctx) {
  const webServer = ctx.get("webServer");
  if (webServer === void 0) throw new Error("dsh-git: webServer service unavailable");
  const disposers = [];
  disposers.push(webServer.register({ kind: "prefix", path: "/dsh-git", handler: handle }));
  ctx.on("dispose", () => {
    for (const dispose of disposers) dispose();
  });
}

export { Config, apply, inject, name };
