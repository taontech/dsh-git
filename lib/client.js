// dsh-git client bundle —— 注册 conversation.view slot 上的 Git tab。
//
// 这份文件是浏览器端模块（ModuleLoader 格式，手写、免构建）：
//   window.__ModuleLoader__.load({ id, factory }) ，factory 只允许 require
//   平台 seed 词（react 等）与 boot graph 里的其他模块。git 数据全部来自
//   server 端同源 JSON API（/dsh-git/*，由本包 lib/index.js 提供）。
window.__ModuleLoader__.load({
	id: "@taontech/dsh-git",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const { jsx, jsxs, Fragment } = require("react/jsx-runtime");
		const React = require("react");
		const { useCallback, useEffect, useState } = React;

		// ── 样式（独立 CSS，使用 DSW 设计变量保持一致观感）──────────────
		const CSS_ID = "dsh-git";
		const css = [
			".dsh-git{display:flex;flex-direction:column;gap:12px;height:100%;overflow-y:auto;padding:14px 16px 24px;box-sizing:border-box}",
			".dsh-git-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dsh-git-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dsh-git-path{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}",
			".dsh-git-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 12px;font-size:12px;line-height:20px;cursor:pointer}",
			".dsh-git-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-btn-primary{background:var(--dsw-alias-accent-strong,var(--dsw-alias-interactive-bg-hover));border-color:transparent;color:var(--dsw-alias-label-on-accent,var(--dsw-alias-label-primary))}",
			".dsh-git-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);overflow:hidden}",
			".dsh-git-card-h{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dsh-git-card-b{padding:10px 14px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary)}",
			".dsh-git-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;font-size:13px;line-height:22px}",
			".dsh-git-kv-k{color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
			".dsh-git-kv-v{color:var(--dsw-alias-label-primary);word-break:break-all;font-family:var(--ds-font-family-code);font-size:12px}",
			".dsh-git-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:22px;padding:12px 2px}",
			".dsh-git-error{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:22px;display:flex;align-items:center;gap:10px;padding:12px 2px;flex-wrap:wrap}",
			".dsh-git-file{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}",
			".dsh-git-file-path{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-git-file-path.renamed{color:var(--dsw-alias-label-secondary)}",
			".dsh-git-badge{font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;border-radius:4px;padding:0 5px;flex:none}",
			".dsh-git-badge.mod{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e8a33d)}",
			".dsh-git-badge.add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 18%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-badge.del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 18%,transparent);color:var(--dsw-alias-state-error-primary,#f85149)}",
			".dsh-git-badge.untracked{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 18%,transparent);color:var(--dsw-alias-label-secondary)}",
			".dsh-git-badge.ren{background:color-mix(in srgb,#8250df 18%,transparent);color:#8250df}",
			".dsh-git-badge.con{background:color-mix(in srgb,#f85149 18%,transparent);color:#f85149}",
			".dsh-git-log{display:flex;flex-direction:column;padding:4px 0}",
			".dsh-git-log-row{display:flex;align-items:baseline;gap:10px;padding:5px 14px;font-size:13px;line-height:20px}",
			".dsh-git-log-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-log-hash{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}",
			".dsh-git-log-subject{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}",
			".dsh-git-log-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none;white-space:nowrap}",
			".dsh-git-graph{font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);white-space:pre;overflow-x:auto;padding:8px 14px}",
			".dsh-git-branch{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px;line-height:20px;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-primary)}",
			".dsh-git-branch-current{color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-file-size{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}",
			".dsh-git-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 8%,transparent);font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary);flex-wrap:wrap}",
			".dsh-git-action{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:1px 8px;font-size:11px;line-height:18px;cursor:pointer;flex:none}",
			".dsh-git-action:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-action[disabled]{opacity:.45;cursor:default;pointer-events:none}",
			".dsh-git-input{flex:1;min-width:120px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 10px;font-size:13px;line-height:20px;outline:none}",
			".dsh-git-input:focus{border-color:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-commitbar{display:flex;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap}",
			".dsh-git-syncbar{display:flex;align-items:center;gap:8px;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l2)}",
			".dsh-git-staged-count{font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-git-notice{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;font-size:13px;line-height:20px;flex-wrap:wrap}",
			".dsh-git-notice.error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 10%,transparent);color:var(--dsw-alias-state-error-primary,#f85149)}",
			".dsh-git-notice.ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 10%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}"
		].join("");
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=\"" + CSS_ID + "\"]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = CSS_ID;
			tag.dataset.pluginCss = CSS_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		// ── locale 字典（NS = "git"）────────────────────────────────────
		const NS = "git";
		const zh = {
			"view.git": "Git",
			"toolbar.refresh": "刷新",
			"repo.root": "仓库根目录",
			"repo.branch": "当前分支",
			"repo.remote": "远端地址",
			"repo.lastCommit": "最近提交",
			"repo.dirty": "工作区有未提交修改",
			"repo.clean": "工作区干净",
			"ahead": "领先",
			"behind": "落后",
			"files.title": "文件",
			"files.empty": "没有文件变更",
			"log.title": "提交历史",
			"log.empty": "暂无提交",
			"branches.title": "分支",
			"graph.title": "提交图",
			"notRepo": "当前目录不在 Git 管理下",
			"init": "初始化 Git 仓库",
			"init.running": "初始化中…",
			"loading": "加载中…",
			"no.cwd": "当前会话没有项目路径",
			"retry": "重试",
			"status": "状态",
			"author": "作者",
			"date": "时间",
			"subject": "说明",
			"path": "路径",
			"size": "大小",
			"b": "B",
			"kb": "KB",
			"mb": "MB",
			"error.load": "加载 Git 信息失败",
			"action.stage": "暂存",
			"action.unstage": "取消暂存",
			"action.stageAll": "全部暂存",
			"action.commit": "提交",
			"action.push": "推送",
			"action.pull": "拉取",
			"action.switch": "切换",
			"commit.placeholder": "提交信息…",
			"commit.stagedCount": "已暂存 ",
			"commit.files": " 个文件",
			"notice.staged": "已暂存 ",
			"notice.unstaged": "已取消暂存 ",
			"notice.committed": "提交成功",
			"notice.pushed": "推送成功",
			"notice.pulled": "拉取成功",
			"notice.switched": "已切换到 ",
			"action.failed": "操作失败"
		};
		const en = {
			"view.git": "Git",
			"toolbar.refresh": "Refresh",
			"repo.root": "Repository root",
			"repo.branch": "Current branch",
			"repo.remote": "Remote URL",
			"repo.lastCommit": "Last commit",
			"repo.dirty": "Working tree has uncommitted changes",
			"repo.clean": "Working tree clean",
			"ahead": "ahead",
			"behind": "behind",
			"files.title": "Files",
			"files.empty": "No file changes",
			"log.title": "Commit history",
			"log.empty": "No commits yet",
			"branches.title": "Branches",
			"graph.title": "Commit graph",
			"notRepo": "This directory is not under Git",
			"init": "Initialize Git repository",
			"init.running": "Initializing…",
			"loading": "Loading…",
			"no.cwd": "This session has no project path",
			"retry": "Retry",
			"status": "Status",
			"author": "Author",
			"date": "Date",
			"subject": "Subject",
			"path": "Path",
			"size": "Size",
			"b": "B",
			"kb": "KB",
			"mb": "MB",
			"error.load": "Failed to load Git information",
			"action.stage": "Stage",
			"action.unstage": "Unstage",
			"action.stageAll": "Stage all",
			"action.commit": "Commit",
			"action.push": "Push",
			"action.pull": "Pull",
			"action.switch": "Switch",
			"commit.placeholder": "Commit message…",
			"commit.stagedCount": "",
			"commit.files": " files staged",
			"notice.staged": "Staged ",
			"notice.unstaged": "Unstaged ",
			"notice.committed": "Committed",
			"notice.pushed": "Pushed",
			"notice.pulled": "Pulled",
			"notice.switched": "Switched to ",
			"action.failed": "Action failed"
		};

		// ── 工具 ───────────────────────────────────────────────────────
		async function fetchJson(url, options) {
			const res = await fetch(url, options);
			let data = null;
			try {
				data = await res.json();
			} catch { /* non-JSON */ }
			if (!res.ok) {
				const message = data && data.error ? data.error : "HTTP " + res.status;
				throw new Error(message);
			}
			return data;
		}

		function formatSize(bytes) {
			if (bytes === void 0) return "";
			if (bytes < 1024) return bytes + " B";
			if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
			return (bytes / 1024 / 1024).toFixed(1) + " MB";
		}

		const STATUS_META = {
			"M": { label: "M", cls: "mod" },
			"A": { label: "A", cls: "add" },
			"D": { label: "D", cls: "del" },
			"R": { label: "R", cls: "ren" },
			"C": { label: "C", cls: "ren" },
			"U": { label: "U", cls: "con" },
			"?": { label: "?", cls: "untracked" }
		};

		function statusBadge(code) {
			const meta = STATUS_META[code] || { label: code, cls: "mod" };
			return jsx("span", { className: "dsh-git-badge " + meta.cls, children: meta.label });
		}

		// ── 视图组件 ───────────────────────────────────────────────────
		function RepoInfo({ info, t }) {
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", { className: "dsh-git-card-h", children: t("repo.branch") + "  ·  " + (info.branch || "—") + (info.isDirty ? "  ·  " + t("repo.dirty") : "  ·  " + t("repo.clean")) }),
					jsx("div", {
						className: "dsh-git-card-b",
						children: jsxs("div", {
							className: "dsh-git-kv",
							children: [
								jsx("span", { className: "dsh-git-kv-k", children: t("repo.root") }),
								jsx("span", { className: "dsh-git-kv-v", children: info.root }),
								jsx("span", { className: "dsh-git-kv-k", children: t("repo.remote") }),
								jsx("span", { className: "dsh-git-kv-v", children: info.remoteUrl || "—" }),
								info.ahead !== null && jsx(Fragment, { children: [
									jsx("span", { className: "dsh-git-kv-k", children: t("ahead") + " / " + t("behind") }),
									jsx("span", { className: "dsh-git-kv-v", children: info.ahead + " / " + info.behind })
								] }),
								info.lastCommit && jsx(Fragment, { children: [
									jsx("span", { className: "dsh-git-kv-k", children: t("repo.lastCommit") }),
									jsx("span", { className: "dsh-git-kv-v", children: info.lastCommit.shortHash + "  " + info.lastCommit.subject + "  (" + info.lastCommit.author + ", " + info.lastCommit.date + ")" })
								] })
							]
						})
					})
				]
			});
		}

		function FileList({ files, t, onStage, onUnstage, busy }) {
			if (!files || files.length === 0) return jsx("div", { className: "dsh-git-muted", children: t("files.empty") });
			const stageable = files.filter((file) => file.gitPath && file.worktree !== " ");
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", {
						className: "dsh-git-card-h",
						children: [
							jsx("span", { children: t("files.title") + " (" + files.length + ")" }),
							stageable.length > 0 && jsx("button", {
								type: "button",
								className: "dsh-git-action",
								disabled: busy,
								onClick: () => onStage(stageable.map((file) => file.gitPath)),
								children: t("action.stageAll") + " (" + stageable.length + ")"
							})
						]
					}),
					jsx("div", {
						className: "dsh-git-card-b",
						children: files.map((file) => jsxs("div", {
							className: "dsh-git-file",
							children: [
								file.status ? jsxs(Fragment, { children: [statusBadge(file.status[0] === " " ? file.status[1] : file.status[0]), file.status[0] !== " " && statusBadge(file.status[1])] }) : jsx("span", { className: "dsh-git-badge untracked", children: "·" }),
								jsx("span", { className: "dsh-git-file-path" + (file.status && file.status[1] === "R" ? " renamed" : ""), children: file.path }),
								jsx("span", { className: "dsh-git-file-size", children: formatSize(file.size) }),
								file.gitPath && file.worktree !== " " && jsx("button", {
									type: "button",
									className: "dsh-git-action",
									disabled: busy,
									onClick: () => onStage([file.gitPath]),
									children: t("action.stage")
								}),
								file.gitPath && file.index !== " " && file.index !== "?" && jsx("button", {
									type: "button",
									className: "dsh-git-action",
									disabled: busy,
									onClick: () => onUnstage([file.gitPath]),
									children: t("action.unstage")
								})
							]
						}, file.path))
					})
				]
			});
		}

		function CommitCard({ files, t, onCommit, onPush, onPull, busy, canSync }) {
			const stagedCount = files ? files.filter((file) => file.index !== " " && file.index !== "?").length : 0;
			const [message, setMessage] = React.useState("");
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", {
						className: "dsh-git-card-h",
						children: [
							jsx("span", { children: t("action.commit") }),
							jsx("span", { className: "dsh-git-staged-count", children: t("commit.stagedCount") + stagedCount + t("commit.files") })
						]
					}),
					jsxs("div", {
						className: "dsh-git-commitbar",
						children: [
							jsx("input", {
								className: "dsh-git-input",
								value: message,
								placeholder: t("commit.placeholder"),
								disabled: busy,
								onChange: (event) => setMessage(event.target.value),
								onKeyDown: (event) => {
									if (event.key === "Enter" && !event.shiftKey && message.trim() !== "" && stagedCount > 0) {
										onCommit(message);
										setMessage("");
									}
								}
							}),
							jsx("button", {
								type: "button",
								className: "dsh-git-btn",
								disabled: busy || stagedCount === 0 || message.trim() === "",
								onClick: () => {
									onCommit(message);
									setMessage("");
								},
								children: t("action.commit")
							})
						]
					}),
					canSync && jsxs("div", {
						className: "dsh-git-syncbar",
						children: [
							jsx("button", { type: "button", className: "dsh-git-btn", disabled: busy, onClick: onPush, children: t("action.push") }),
							jsx("button", { type: "button", className: "dsh-git-btn", disabled: busy, onClick: onPull, children: t("action.pull") })
						]
					})
				]
			});
		}

		function CommitList({ commits, t }) {
			if (!commits || commits.length === 0) return jsx("div", { className: "dsh-git-muted", children: t("log.empty") });
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", { className: "dsh-git-card-h", children: t("log.title") + " (" + commits.length + ")" }),
					jsx("div", {
						className: "dsh-git-log",
						children: commits.map((commit) => jsxs("div", {
							className: "dsh-git-log-row",
							children: [
								jsx("span", { className: "dsh-git-log-hash", children: commit.shortHash }),
								jsx("span", { className: "dsh-git-log-subject", children: commit.subject }),
								jsx("span", { className: "dsh-git-log-meta", children: commit.author + " · " + commit.date })
							]
						}, commit.hash))
					})
				]
			});
		}

		function BranchList({ data, t, onSwitch, busy }) {
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", { className: "dsh-git-card-h", children: t("branches.title") + " (" + (data.branches ? data.branches.length : 0) + ")" }),
					jsx("div", {
						className: "dsh-git-card-b",
						children: [
							data.branches && data.branches.map((branch) => jsxs("div", {
								className: "dsh-git-branch" + (branch.current ? " dsh-git-branch-current" : ""),
								children: [
									jsx("span", { children: branch.current ? "*" : " " }),
									jsx("span", { children: branch.name }),
									branch.upstream && jsx("span", { className: "dsh-git-log-meta", children: "→ " + branch.upstream }),
									!branch.current && jsx("button", {
										type: "button",
										className: "dsh-git-action",
										disabled: busy,
										onClick: () => onSwitch(branch.name),
										children: t("action.switch")
									})
								]
							}, branch.name)),
							data.graph ? jsx("div", { className: "dsh-git-graph", children: data.graph }) : null
						]
					})
				]
			});
		}

		function GitView({ sessionId, useSessions, t }) {
			const cwd = useSessions((s) => (s && s.byId && s.byId[sessionId] && s.byId[sessionId].cwd) || null);
			const [view, setView] = useState({ kind: "loading" });
			const [busy, setBusy] = useState(false);
			const [notice, setNotice] = useState(null);
			const load = useCallback(() => {
				if (!cwd) {
					setView({ kind: "error", message: t("no.cwd") });
					return Promise.resolve();
				}
				setView({ kind: "loading" });
				const query = "cwd=" + encodeURIComponent(cwd);
				return Promise.all([
					fetchJson("/dsh-git/info?" + query),
					fetchJson("/dsh-git/status?" + query),
					fetchJson("/dsh-git/log?" + query),
					fetchJson("/dsh-git/branches?" + query)
				]).then(([info, status, log, branches]) => {
					setView({ kind: "data", info, status, log, branches });
				}).catch((err) => {
					setView({ kind: "error", message: (err && err.message) || String(err) });
				});
			}, [cwd, t]);
			useEffect(() => {
				load();
			}, [load]);
			/** 执行一个 git 操作：POST → 提示结果 → 刷新（成功后解除 busy）。 */
			const runAction = useCallback((endpoint, payload, okMessage) => {
				if (!cwd || busy) return;
				setBusy(true);
				setNotice(null);
				fetchJson(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(Object.assign({ cwd }, payload))
				}).then((result) => {
					setNotice({ kind: "ok", message: okMessage(result) });
					return load();
				}).then(() => {
					setBusy(false);
				}).catch((err) => {
					setNotice({ kind: "error", message: t("action.failed") + ": " + ((err && err.message) || String(err)) });
					setBusy(false);
				});
			}, [cwd, busy, load, t]);
			const stage = useCallback((paths) => {
				runAction("/dsh-git/stage", { paths }, (result) => t("notice.staged") + (result.staged ? result.staged.length : 0) + t("commit.files"));
			}, [runAction, t]);
			const unstage = useCallback((paths) => {
				runAction("/dsh-git/unstage", { paths }, (result) => t("notice.unstaged") + (result.unstaged ? result.unstaged.length : 0) + t("commit.files"));
			}, [runAction, t]);
			const commit = useCallback((message) => {
				runAction("/dsh-git/commit", { message }, () => t("notice.committed"));
			}, [runAction, t]);
			const push = useCallback(() => {
				runAction("/dsh-git/push", {}, () => t("notice.pushed"));
			}, [runAction, t]);
			const pull = useCallback(() => {
				runAction("/dsh-git/pull", {}, () => t("notice.pulled"));
			}, [runAction, t]);
			const switchBranch = useCallback((branch) => {
				runAction("/dsh-git/checkout", { branch }, () => t("notice.switched") + branch);
			}, [runAction, t]);
			const init = useCallback(() => {
				if (!cwd || busy) return;
				setBusy(true);
				setNotice(null);
				fetchJson("/dsh-git/init", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ cwd })
				}).then(() => {
					setNotice({ kind: "ok", message: t("notice.committed") });
					return load();
				}).then(() => {
					setBusy(false);
				}).catch((err) => {
					setNotice({ kind: "error", message: t("action.failed") + ": " + ((err && err.message) || String(err)) });
					setBusy(false);
				});
			}, [cwd, busy, load, t]);

			return jsxs("div", {
				className: "dsh-git",
				children: [
					jsxs("div", {
						className: "dsh-git-toolbar",
						children: [
							jsx("span", { className: "dsh-git-title", children: t("view.git") }),
							cwd && jsx("span", { className: "dsh-git-path", children: cwd }),
							jsx("button", { type: "button", className: "dsh-git-btn", disabled: busy, onClick: load, children: t("toolbar.refresh") })
						]
					}),
					notice && jsxs("div", {
						className: "dsh-git-notice " + notice.kind,
						children: [
							jsx("span", { children: notice.message }),
							jsx("button", { type: "button", className: "dsh-git-action", onClick: () => setNotice(null), children: "✕" })
						]
					}),
					view.kind === "loading" && jsx("div", { className: "dsh-git-muted", children: t("loading") }),
					view.kind === "error" && jsxs("div", {
						className: "dsh-git-error",
						children: [
							jsx("span", { children: t("error.load") + ": " + view.message }),
							jsx("button", { type: "button", className: "dsh-git-btn", onClick: load, children: t("retry") })
						]
					}),
					view.kind === "data" && jsxs(Fragment, { children: [
						!view.info.isRepo && jsxs("div", {
							className: "dsh-git-banner",
							children: [
								jsx("span", { children: t("notRepo") }),
								jsx("button", { type: "button", className: "dsh-git-btn dsh-git-btn-primary", disabled: busy, onClick: init, children: t("init") })
							]
						}),
						view.info.isRepo && jsxs(Fragment, { children: [
							jsx(RepoInfo, { info: view.info, t }),
							jsx(FileList, { files: view.status.files, t, onStage: stage, onUnstage: unstage, busy }),
							jsx(CommitCard, { files: view.status.files, t, onCommit: commit, onPush: push, onPull: pull, busy, canSync: !!view.info.remoteUrl }),
							jsx(CommitList, { commits: view.log.commits, t }),
							jsx(BranchList, { data: view.branches, t, onSwitch: switchBranch, busy })
						] }),
						!view.info.isRepo && jsx(FileList, { files: view.status.files, t })
					] })
				]
			});
		}

		// ── 插件入口 ────────────────────────────────────────────────────
		const inject = ["slots", "conversationViews", "sessions", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-git: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "git",
				order: 20,
				locale: NS,
				label: () => t("view.git"),
				inject: (sessionId) => ({})
			}, GitView));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
