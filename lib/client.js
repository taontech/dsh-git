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
		const ReactDOM = require("react-dom");
		const { createPortal } = ReactDOM;
		const { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } = React;

		// ── 样式（独立 CSS，使用 DSW 设计变量保持一致观感）──────────────
		const CSS_ID = "dsh-git";
		const css = [
			".dsh-git{display:flex;flex-direction:column;gap:12px;height:100%;overflow-y:auto;padding:14px 16px 24px;box-sizing:border-box}",
			".dsh-git-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".dsh-git-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}",
			".dsh-git-path{font-family:var(--ds-font-family-code);font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;cursor:pointer}",
			".dsh-git-path:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}",
			".dsh-git-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:4px 12px;font-size:12px;line-height:20px;cursor:pointer;transition:all .15s;position:relative}",
			".dsh-git-btn:hover:not([disabled]){background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-btn[disabled]{opacity:.55;cursor:not-allowed}",
			".dsh-git-btn-primary{background:var(--dsw-alias-accent-strong,var(--dsw-alias-interactive-bg-hover));border-color:transparent;color:var(--dsw-alias-label-on-accent,var(--dsw-alias-label-primary))}",
			".dsh-git-grid{display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:14px;align-items:start;min-width:0}",
			"@media(max-width:960px){.dsh-git-grid{grid-template-columns:minmax(0,1fr)}}",
			".dsh-git-col{display:flex;flex-direction:column;gap:14px;min-width:0}",
			".dsh-git-card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.03);overflow:hidden;transition:box-shadow .2s}",
			".dsh-git-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);position:relative;flex-wrap:wrap}",
			".dsh-git-card-b{padding:10px 14px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary)}",
			".dsh-git-kv{display:grid;grid-template-columns:auto 1fr;gap:2px 14px;font-size:13px;line-height:22px}",
			".dsh-git-kv-k{color:var(--dsw-alias-label-tertiary);white-space:nowrap}",
			".dsh-git-kv-v{color:var(--dsw-alias-label-primary);word-break:break-all;font-family:var(--ds-font-family-code);font-size:12px;min-width:0}",
			".dsh-git-muted{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:22px;padding:12px 2px}",
			".dsh-git-error{color:var(--dsw-alias-state-error-primary);font-size:13px;line-height:22px;display:flex;align-items:center;gap:10px;padding:12px 2px;flex-wrap:wrap}",
			".dsh-git-badge{font-family:var(--ds-font-family-code);font-size:11px;line-height:16px;border-radius:4px;padding:0 5px;flex:none}",
			".dsh-git-badge.mod{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 18%,transparent);color:var(--dsw-alias-state-warning-primary,#e8a33d)}",
			".dsh-git-badge.add{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 18%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-badge.del{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 18%,transparent);color:var(--dsw-alias-state-error-primary,#f85149)}",
			".dsh-git-badge.untracked{background:color-mix(in srgb,var(--dsw-alias-label-secondary) 18%,transparent);color:var(--dsw-alias-label-secondary)}",
			".dsh-git-badge.ren{background:color-mix(in srgb,#8250df 18%,transparent);color:#8250df}",
			".dsh-git-badge.con{background:color-mix(in srgb,#f85149 18%,transparent);color:#f85149}",
			".dsh-git-log{display:flex;flex-direction:column;padding:4px 0;max-height:420px;overflow-y:auto}",
			".dsh-git-log-row{display:flex;flex-direction:column;gap:3px;padding:8px 10px;cursor:pointer;border-radius:8px;margin:2px 4px;transition:background .15s;min-width:0}",
			".dsh-git-log-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-log-subject{font-size:12px;font-weight:600;line-height:16px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			".dsh-git-log-meta{display:flex;align-items:center;gap:6px;font-size:11px;line-height:14px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}",
			".dsh-git-log-hash{font-family:var(--ds-font-family-code);font-size:11px;color:var(--dsw-alias-accent-strong,#4285f4);font-weight:600;flex:none}",
			".dsh-git-file-size{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}",
			".dsh-git-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 8%,transparent);box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.03);font-size:13px;line-height:22px;color:var(--dsw-alias-label-primary);flex-wrap:wrap}",
			".dsh-git-action{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);border-radius:6px;padding:1px 8px;font-size:11px;line-height:18px;cursor:pointer;flex:none;transition:all .15s}",
			".dsh-git-action:hover:not([disabled]){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-action[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}",
			".dsh-git-input{flex:1;min-width:120px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 10px;font-size:13px;line-height:20px;outline:none}",
			".dsh-git-input:focus{border-color:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-commitbar{display:flex;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap}",
			".dsh-git-staged-count{font-size:12px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-git-notice{display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:10px;font-size:13px;line-height:20px;flex-wrap:wrap}",
			".dsh-git-notice.error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 10%,transparent);color:var(--dsw-alias-state-error-primary,#f85149)}",
			".dsh-git-notice.ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 10%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-busy-banner{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 14%,transparent);color:var(--dsw-alias-accent-strong,#4285f4);font-size:13px;font-weight:600;line-height:20px}",
			"@keyframes dsh-git-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
			".dsh-git-spinner{display:inline-block;width:13px;height:13px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:dsh-git-spin .75s linear infinite;vertical-align:middle;flex:none}",
			
			/* 当前分支概况卡片与快捷启动方块按钮（高度一致为 210px） */
			".dsh-git-overview-card{height:210px;min-height:210px;display:flex;flex-direction:column;box-sizing:border-box}",
			".dsh-git-overview-card .dsh-git-card-b{flex:1;display:flex;flex-direction:column;justify-content:center;padding:12px 16px;box-sizing:border-box}",
			".dsh-git-qa-card{height:210px;min-height:210px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}",
			".dsh-git-qa-card .dsh-git-card-b{padding:14px 16px;flex:1;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box}",
			".dsh-git-qa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0;width:100%}",
			".dsh-git-qa-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;height:74px;padding:8px 4px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;transition:all .15s;box-sizing:border-box;text-decoration:none;width:100%;box-shadow:0 1px 2px rgba(0,0,0,0.03)}",
			".dsh-git-qa-btn:hover:not([disabled]){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-accent-strong,#4285f4);transform:translateY(-1px);box-shadow:0 3px 8px rgba(0,0,0,0.08)}",
			".dsh-git-qa-btn[disabled]{opacity:.45;cursor:not-allowed}",
			".dsh-git-qa-icon{width:22px;height:22px;display:flex;align-items:center;justify-content:center;pointer-events:none;flex:none}",
			".dsh-git-qa-icon svg{width:20px;height:20px;display:block}",
			".dsh-git-qa-label{font-size:11px;font-weight:500;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center}",
			
			/* 工作区文件与搜索/切换 */
			".dsh-git-filetabs{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:2px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 80%,black 5%)}",
			".dsh-git-filetab{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:500;padding:2px 8px;border-radius:4px;cursor:pointer;transition:all .15s}",
			".dsh-git-filetab.active{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,0.08)}",
			".dsh-git-search-wrap{display:flex;align-items:center;gap:6px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-base) 90%,black 2%)}",
			".dsh-git-search-input{flex:1;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:3px 8px;font-size:12px;outline:none}",
			".dsh-git-search-input:focus{border-color:var(--dsw-alias-accent-strong,#4285f4)}",
			".dsh-git-filelist-wrap{max-height:440px;overflow-y:auto;display:flex;flex-direction:column;padding:4px 0}",
			".dsh-git-file-row{display:flex;align-items:center;gap:8px;padding:6px 12px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:6px;margin:1px 4px;transition:background .12s}",
			".dsh-git-file-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-file-row.active{background:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 12%,transparent);font-weight:600}",
			".dsh-git-file-icon{width:15px;height:15px;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary);flex:none}",
			".dsh-git-file-icon svg{width:14px;height:14px;display:block}",
			".dsh-git-file-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code);font-size:12px}",
			".dsh-git-file-name.renamed{color:var(--dsw-alias-label-secondary)}",

			/* 文件内容查看视图（复用 gmc 设计与行号代码展示） */
			".dsh-git-fileview{display:flex;flex-direction:column;min-width:0}",
			".dsh-git-fileview-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;background:color-mix(in srgb,var(--dsw-alias-bg-base) 92%,black 2%)}",
			".dsh-git-fileview-title-group{display:flex;align-items:center;gap:8px;min-width:0;flex:1;flex-wrap:wrap}",
			".dsh-git-fileview-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-git-fileview-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-git-fileview-tag{font-family:var(--ds-font-family-code);font-size:10px;padding:1px 6px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary) 15%,transparent);color:var(--dsw-alias-label-secondary)}",
			".dsh-git-fileview-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
			".dsh-git-breadcrumb{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);overflow-x:auto;padding:6px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}",
			".dsh-git-breadcrumb-btn{border:none;background:transparent;padding:0;color:var(--dsw-alias-accent-strong,#4285f4);font-size:12px;font-family:var(--ds-font-family-code);cursor:pointer;text-decoration:none}",
			".dsh-git-breadcrumb-btn:hover{text-decoration:underline}",
			".dsh-git-breadcrumb-current{color:var(--dsw-alias-label-primary);font-weight:600}",
			".dsh-git-code-view{margin:0;padding:4px 0;max-height:520px;overflow:auto;background:var(--dsw-alias-bg-base);font-family:var(--ds-font-family-code);font-size:12px;line-height:20px}",
			".dsh-git-code-line{display:grid;grid-template-columns:44px minmax(0,1fr);min-width:100%;width:max-content}",
			".dsh-git-code-line:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-code-line-no{user-select:none;text-align:right;padding-right:12px;color:var(--dsw-alias-label-tertiary);font-size:11px;border-right:1px solid var(--dsw-alias-border-l2)}",
			".dsh-git-code-line-text{padding-left:12px;white-space:pre;color:var(--dsw-alias-label-primary)}",
			".dsh-git-image-preview{display:flex;align-items:center;justify-content:center;padding:24px;max-height:480px;overflow:auto;background:color-mix(in srgb,var(--dsw-alias-bg-base) 80%,black 5%)}",
			".dsh-git-image-preview img{max-width:100%;max-height:440px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.12);object-fit:contain}",
			".dsh-git-binary-notice{display:flex;align-items:center;justify-content:center;padding:40px 16px;color:var(--dsw-alias-label-tertiary);font-size:13px}",

			/* 概况 & 分支选择器 & 贡献日历 */
			".dsh-git-overview{display:grid;grid-template-columns:1fr 2fr;gap:16px;align-items:center}",
			"@media(max-width:800px){.dsh-git-overview{grid-template-columns:1fr}}",
			".dsh-git-overview-info{min-width:0;display:flex;flex-direction:column;gap:8px}",
			".dsh-git-overview-cal{min-width:0;overflow:hidden;width:100%}",
			".dsh-git-branch-selector-wrap{position:relative;display:inline-block}",
			".dsh-git-branch-selector-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;font-family:var(--ds-font-family-code);cursor:pointer;transition:all .15s}",
			".dsh-git-branch-selector-btn:hover:not([disabled]),.dsh-git-branch-selector-btn.open{border-color:var(--dsw-alias-accent-strong,#4285f4);background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-branch-selector-btn[disabled]{opacity:.55;cursor:not-allowed}",
			".dsh-git-branch-chevron{width:12px;height:12px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-git-branch-menu{position:absolute;left:0;top:calc(100% + 4px);z-index:999;min-width:240px;max-height:280px;overflow-y:auto;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.18);padding:4px;display:flex;flex-direction:column;gap:2px}",
			".dsh-git-branch-item{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;border:none;background:transparent;color:var(--dsw-alias-label-primary);font-size:12px;font-family:var(--ds-font-family-code);cursor:pointer;text-align:left;width:100%;box-sizing:border-box}",
			".dsh-git-branch-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-git-branch-item.current{color:var(--dsw-alias-state-success-primary,#3fb950);font-weight:600;background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 10%,transparent)}",
			".dsh-git-branch-item-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-git-branch-item-tag{font-size:10px;color:var(--dsw-alias-label-tertiary)}",
			".dsh-git-title-notice{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:500;padding:2px 8px;border-radius:6px;line-height:16px;margin-left:4px}",
			".dsh-git-title-notice.busy{background:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 14%,transparent);color:var(--dsw-alias-accent-strong,#4285f4)}",
			".dsh-git-title-notice.error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#f85149) 12%,transparent);color:var(--dsw-alias-state-error-primary,#f85149)}",
			".dsh-git-title-notice.ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-title-notice-close{border:none;background:transparent;color:inherit;padding:0 0 0 4px;cursor:pointer;font-size:10px;line-height:1;opacity:.7}",
			".dsh-git-title-notice-close:hover{opacity:1}",
			".dsh-git-cal{--cal-cell:10px;--cal-gap:3px;--cal-label-width:18px;display:grid;grid-template-columns:var(--cal-label-width) minmax(0,1fr);grid-template-rows:14px auto;column-gap:6px;row-gap:4px;overflow:hidden;width:100%;box-sizing:border-box}",
			".dsh-git-cal-months{grid-column:2;grid-row:1;position:relative;height:14px;min-width:0;overflow:hidden}",
			".dsh-git-cal-month{position:absolute;top:0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:13px;white-space:nowrap}",
			".dsh-git-cal-weekdays{grid-column:1;grid-row:2;display:flex;flex-direction:column;gap:var(--cal-gap);align-items:flex-end}",
			".dsh-git-cal-weekday{height:var(--cal-cell);color:var(--dsw-alias-label-tertiary);font-size:9px;line-height:var(--cal-cell);text-align:right;white-space:nowrap}",
			".dsh-git-cal-weeks{grid-column:2;grid-row:2;display:flex;gap:var(--cal-gap);min-width:0;overflow:hidden}",
			".dsh-git-cal-col{display:flex;flex-direction:column;gap:var(--cal-gap);flex:0 0 var(--cal-cell)}",
			".dsh-git-cal-cell{flex:0 0 var(--cal-cell);width:var(--cal-cell);height:var(--cal-cell);border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#8b949e) 20%,transparent)}",
			".dsh-git-cal-cell.empty{background:transparent}",
			".dsh-git-cal-cell[data-level=\"1\"]{background:#9be9a8}",
			".dsh-git-cal-cell[data-level=\"2\"]{background:#40c463}",
			".dsh-git-cal-cell[data-level=\"3\"]{background:#30a14e}",
			".dsh-git-cal-cell[data-level=\"4\"]{background:#216e39}",
			".dsh-git-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box}",
			".dsh-git-modal{background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;width:min(680px,100%);max-height:85vh;display:flex;flex-direction:column;box-shadow:0 16px 40px rgba(0,0,0,0.28);overflow:hidden}",
			".dsh-git-modal-h{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}",
			".dsh-git-modal-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:8px}",
			".dsh-git-modal-b{padding:16px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}",
			".dsh-git-modal-section-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary);margin-bottom:4px}",
			".dsh-git-modal-stat{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px;background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#8b949e) 10%,transparent);padding:10px 12px;border-radius:8px;white-space:pre-wrap;overflow-x:auto;border:1px solid var(--dsw-alias-border-l2)}",
			".dsh-git-modal-msg{font-size:13px;line-height:22px;white-space:pre-wrap;color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code)}",

			/* 首页 Hero 概况卡片（全宽独立展示在上半区，分卡片区域：仓库概况 + 快捷启动） */
			"[data-phase=\"hero\"] [data-conversation-scroll]{justify-content:flex-start !important}",
			".dsh-git-hero{order:-100 !important;display:grid;grid-template-columns:minmax(0,1fr) 350px;gap:14px;width:100% !important;max-width:100% !important;box-sizing:border-box;padding:20px 32px 16px 32px;margin:0 0 16px 0 !important;flex:none !important;animation:dsh-git-fade-in .2s ease-out}",
			"@media(max-width:960px){.dsh-git-hero{grid-template-columns:minmax(0,1fr);padding:16px;}}",
			".dsh-git-hero-wide{grid-column:1/-1}",
			"@keyframes dsh-git-fade-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}",
			".dsh-git-hero-card{height:210px;min-height:210px;display:flex;flex-direction:column;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-base);box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.03);overflow:hidden;position:relative;transition:box-shadow .25s ease,transform .25s ease,border-color .25s ease}",
			".dsh-git-hero-card::before{content:'';position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 55%,transparent),transparent);opacity:.6;pointer-events:none}",
			".dsh-git-hero-card:hover{box-shadow:0 6px 20px rgba(0,0,0,0.07),0 16px 40px rgba(0,0,0,0.06),0 0 28px color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 12%,transparent);transform:translateY(-1px);border-color:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 28%,var(--dsw-alias-border-l2))}",
			".dsh-git-hero-card-h{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);position:relative;flex-wrap:wrap;background:linear-gradient(135deg,color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 7%,transparent),transparent 55%)}",
			".dsh-git-hero-card-b{flex:1;display:flex;flex-direction:column;justify-content:center;padding:12px 16px;box-sizing:border-box}",
			".dsh-git-hero-meta{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--dsw-alias-label-primary);font-weight:600;min-width:0;flex:1;flex-wrap:wrap}",
			".dsh-git-hero-btn-nav{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#fff;background:linear-gradient(135deg,#4285f4,#7c4dff);border:none;border-radius:8px;padding:6px 16px;cursor:pointer;transition:all .2s ease;text-decoration:none;box-shadow:0 4px 14px rgba(66,133,244,0.35),inset 0 1px 0 rgba(255,255,255,0.18);text-shadow:0 1px 2px rgba(0,0,0,0.18)}",
			".dsh-git-hero-btn-nav:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(124,77,255,0.45),inset 0 1px 0 rgba(255,255,255,0.2);filter:brightness(1.06)}",
			".dsh-git-hero-btn-nav:active{transform:translateY(0)}",
			".dsh-git-hero-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:2px 10px;border-radius:999px;line-height:18px;transition:all .2s}",
			".dsh-git-hero-status-dot{width:7px;height:7px;border-radius:50%;flex:none}",
			".dsh-git-hero-status.dirty{background:color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 12%,transparent);color:var(--dsw-alias-state-warning-primary,#e8a33d)}",
			".dsh-git-hero-status.clean{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 12%,transparent);color:var(--dsw-alias-state-success-primary,#3fb950)}",
			".dsh-git-hero-status.dirty .dsh-git-hero-status-dot{background:var(--dsw-alias-state-warning-primary,#e8a33d);animation:dsh-git-pulse 1.8s ease-in-out infinite}",
			".dsh-git-hero-status.clean .dsh-git-hero-status-dot{background:var(--dsw-alias-state-success-primary,#3fb950);box-shadow:0 0 6px color-mix(in srgb,var(--dsw-alias-state-success-primary,#3fb950) 60%,transparent)}",
			"@keyframes dsh-git-pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-warning-primary,#e8a33d) 45%,transparent)}50%{opacity:.6;box-shadow:0 0 0 6px transparent}}",
			".dsh-git-path-btn{display:inline-flex;align-items:center;gap:6px;max-width:100%;border:none;background:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 8%,transparent);color:var(--dsw-alias-accent-strong,#4285f4);border-radius:7px;padding:3px 10px;font-family:var(--ds-font-family-code);font-size:12px;line-height:20px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:all .18s ease;text-align:left}",
			".dsh-git-path-btn:hover{background:color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 16%,transparent);box-shadow:0 2px 10px color-mix(in srgb,var(--dsw-alias-accent-strong,#4285f4) 28%,transparent);transform:translateY(-1px)}",
			".dsh-git-path-btn svg{width:13px;height:13px;flex:none}",
			".dsh-git-clamp-2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;white-space:normal}",
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
			"repo.local": "本地地址",
			"repo.remote": "远端地址",
			"repo.dirty": "工作区有未提交修改",
			"repo.clean": "工作区干净",
			"ahead": "领先",
			"behind": "落后",
			"files.workspace": "工作区文件",
			"files.all": "所有文件",
			"files.changed": "变更文件",
			"files.search": "搜索文件…",
			"files.empty": "工作区干净，无文件变更",
			"files.emptyWorkspace": "工作区无文件",
			"files.emptySearch": "未找到匹配的文件",
			"log.title": "提交历史",
			"log.empty": "暂无提交",
			"notRepo": "当前目录不在 Git 管理下",
			"init": "初始化 Git 仓库",
			"init.running": "初始化中…",
			"loading": "加载中…",
			"loadingFile": "加载文件内容中…",
			"no.cwd": "当前会话没有项目路径",
			"retry": "重试",
			"status": "状态",
			"author": "作者",
			"date": "时间",
			"subject": "说明",
			"path": "路径",
			"size": "大小",
			"lines": "行",
			"error.load": "加载 Git 信息失败",
			"action.stage": "暂存",
			"action.unstage": "取消暂存",
			"action.stageAll": "全部暂存",
			"action.commit": "提交",
			"action.push": "推送",
			"action.pull": "拉取",
			"action.switch": "切换",
			"action.switchBranch": "切换分支",
			"action.pushing": "推送中…",
			"action.pulling": "拉取中…",
			"action.committing": "提交中…",
			"action.staging": "暂存中…",
			"action.unstaging": "取消暂存中…",
			"action.switching": "切换中…",
			"action.refreshing": "刷新中…",
			"commit.placeholder": "输入提交信息（留空使用 gmc 自动生成）…",
			"commit.gmcAuto": "gmc 自动提交",
			"commit.gmcTip": "安装 gmc 可以自动添加提交信息",
			"commit.stagedCount": "已暂存 ",
			"commit.files": " 个文件",
			"commit.detail": "提交详情",
			"commit.copyHash": "复制哈希",
			"commit.copied": "已复制",
			"commit.message": "提交信息",
			"commit.changes": "修改文件概况",
			"notice.staged": "已暂存 ",
			"notice.unstaged": "已取消暂存 ",
			"notice.committed": "提交成功",
			"notice.pushed": "推送成功",
			"notice.pulled": "拉取成功",
			"notice.switched": "已切换到 ",
			"action.failed": "操作失败",
			"quick.title": "快捷启动",
			"quick.terminal": "终端",
			"quick.finder": "访达",
			"quick.openedTerminal": "已在终端打开",
			"quick.openedIde": "已在编辑器打开 ",
			"quick.launched": "已启动 ",
			"quick.revealFinder": "已在访达中打开",
			"cal.commitsOn": " 次提交于 ",
			"file.back": "返回文件列表",
			"file.copyContent": "复制内容",
			"file.copyPath": "复制路径",
			"file.copied": "已复制",
			"file.binary": "二进制文件，无法直接预览文本",
			"file.large": "文件过大，仅显示前 1MB 内容",
			"file.loadFailed": "加载文件失败",
			"hero.openFull": "进入完整 Git 管理 ➔",
			"hero.fullGitTip": "查看分支图、文件修改、暂存与提交历史",
			"hero.initTip": "当前目录未初始化 Git 仓库",
			"hero.notRepo": "非 Git 仓库"
		};
		const en = {
			"view.git": "Git",
			"toolbar.refresh": "Refresh",
			"repo.root": "Repository root",
			"repo.branch": "Current branch",
			"repo.local": "Local path",
			"repo.remote": "Remote URL",
			"repo.dirty": "Working tree has uncommitted changes",
			"repo.clean": "Working tree clean",
			"ahead": "ahead",
			"behind": "behind",
			"files.workspace": "Workspace Files",
			"files.all": "All Files",
			"files.changed": "Changed Files",
			"files.search": "Search files…",
			"files.empty": "Working tree clean, no changes",
			"files.emptyWorkspace": "No files in workspace",
			"files.emptySearch": "No matching files found",
			"log.title": "Commit History",
			"log.empty": "No commits yet",
			"notRepo": "This directory is not under Git",
			"init": "Initialize Git repository",
			"init.running": "Initializing…",
			"loading": "Loading…",
			"loadingFile": "Loading file…",
			"no.cwd": "This session has no project path",
			"retry": "Retry",
			"status": "Status",
			"author": "Author",
			"date": "Date",
			"subject": "Subject",
			"path": "Path",
			"size": "Size",
			"lines": "lines",
			"error.load": "Failed to load Git information",
			"action.stage": "Stage",
			"action.unstage": "Unstage",
			"action.stageAll": "Stage all",
			"action.commit": "Commit",
			"action.push": "Push",
			"action.pull": "Pull",
			"action.switch": "Switch",
			"action.switchBranch": "Switch branch",
			"action.pushing": "Pushing…",
			"action.pulling": "Pulling…",
			"action.committing": "Committing…",
			"action.staging": "Staging…",
			"action.unstaging": "Unstaging…",
			"action.switching": "Switching…",
			"action.refreshing": "Refreshing…",
			"commit.placeholder": "Commit message (leave empty for gmc auto-commit)…",
			"commit.gmcAuto": "gmc Auto Commit",
			"commit.gmcTip": "Installing gmc enables auto commit messages",
			"commit.stagedCount": "",
			"commit.files": " files staged",
			"commit.detail": "Commit Details",
			"commit.copyHash": "Copy Hash",
			"commit.copied": "Copied",
			"commit.message": "Commit Message",
			"commit.changes": "Changed Files",
			"notice.staged": "Staged ",
			"notice.unstaged": "Unstaged ",
			"notice.committed": "Committed",
			"notice.pushed": "Pushed",
			"notice.pulled": "Pulled",
			"notice.switched": "Switched to ",
			"action.failed": "Action failed",
			"quick.title": "Quick Launch",
			"quick.terminal": "Terminal",
			"quick.finder": "Finder",
			"quick.openedTerminal": "Opened in terminal",
			"quick.openedIde": "Opened in ",
			"quick.launched": "Launched ",
			"quick.revealFinder": "Revealed in Finder",
			"cal.commitsOn": " commits on ",
			"file.back": "Back to files",
			"file.copyContent": "Copy Content",
			"file.copyPath": "Copy Path",
			"file.copied": "Copied",
			"file.binary": "Binary file, cannot preview text",
			"file.large": "File too large, showing first 1MB only",
			"file.loadFailed": "Failed to load file",
			"hero.openFull": "Full Git View ➔",
			"hero.fullGitTip": "View branch graphs, file changes, staging, and commit history",
			"hero.initTip": "Current directory is not a Git repository",
			"hero.notRepo": "Not a Git repository"
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
			if (bytes === void 0 || bytes === null) return "";
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

		// ── 快捷打开 / 贡献日历 工具（移植自 gmc web.js）──────────────
		function addCalendarDays(date, days) {
			const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			d.setDate(d.getDate() + days);
			return d;
		}

		function calendarDateKey(date) {
			const y = date.getFullYear();
			const m = date.getMonth() + 1;
			const d = date.getDate();
			return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d);
		}

		function canOpenLocally() {
			const host = String(window.location.hostname || "");
			return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
		}

		const TERMINAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
		const OPENCODE_ICON = '<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg"><path d="M180 240H60V120H180V240Z" fill="#CFCECD"/><path d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z" fill="#211E1E"/></svg>';
		const CLAUDE_ICON = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="hsl(14.8, 63.1%, 59.6%)"><path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z"/></svg>';
		const CODEX_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" fill-rule="evenodd"><path d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z"/></svg>';
		const ANTIGRAVITY_ICON = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 1c1.1 4.9 3.1 6.9 8 8-4.9 1.1-6.9 3.1-8 8-1.1-4.9-3.1-6.9-8-8 4.9-1.1 6.9-3.1 8-8z" fill="#4285F4"/><path d="M12 13c1.1 2.6 1.9 3.4 4.5 4.5-2.6 1.1-3.4 1.9-4.5 4.5-1.1-2.6-1.9-3.4-4.5-4.5 2.6-1.1 3.4-1.9 4.5-4.5z" fill="#34A853"/></svg>';
		const VSCODE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .32 8.707L4.898 12 .32 15.293a1 1 0 0 0 .007 1.446l1.322 1.202c.369.335.918.36 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.94-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zM18 17.587l-6.5-5.587L18 6.413v11.174z"/></svg>';
		const XCODE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.16 2.05a1.2 1.2 0 0 0-.96.28l-5.6 4.9-1.28-1.28a1.2 1.2 0 0 0-1.7 0L8.14 7.43l3.6 3.6-5.8 5.8a1.2 1.2 0 0 0 0 1.7l1.52 1.52a1.2 1.2 0 0 0 1.7 0l5.8-5.8 3.6 3.6 1.48-1.48a1.2 1.2 0 0 0 0-1.7l-1.28-1.28 4.9-5.6a1.2 1.2 0 0 0 .28-.96 1.2 1.2 0 0 0-.78-.98l-3.9-1.68a1.2 1.2 0 0 0-.3-.06z"/></svg>';
		const ANDROID_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 0 0-.1521-.5676.416.416 0 0 0-.5676.1521l-2.0223 3.503C15.5842 8.411 13.8447 8 12 8s-3.5842.411-5.1368.9507L4.8409 5.4477a.4161.4161 0 0 0-.5677-.1521.4157.4157 0 0 0-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396"/></svg>';
		const FINDER_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><path d="M14 9h4"/><path d="M14 15h4"/></svg>';
		const FILE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';

		function getIdeMeta(ideInfo) {
			if (ideInfo && ideInfo.ide === "xcode") {
				return { label: ideInfo.ideLabel || "Xcode", icon: XCODE_ICON };
			}
			if (ideInfo && ideInfo.ide === "android-studio") {
				return { label: ideInfo.ideLabel || "Android Studio", icon: ANDROID_ICON };
			}
			return { label: (ideInfo && ideInfo.ideLabel) || "VS Code", icon: VSCODE_ICON };
		}

		function ContributionCalendar({ contributions, t }) {
			const ref = useRef(null);
			const [layout, setLayout] = useState({ columns: 20, cell: 10, gap: 3 });
			useLayoutEffect(() => {
				const el = ref.current;
				if (!el) return;
				const measure = () => {
					const styles = window.getComputedStyle(el);
					const cell = parseFloat(styles.getPropertyValue("--cal-cell")) || 10;
					const gap = parseFloat(styles.getPropertyValue("--cal-gap")) || 3;
					const labelWidth = parseFloat(styles.getPropertyValue("--cal-label-width")) || 18;
					const colGap = 6;
					const width = el.clientWidth;
					if (width > 0) {
						const available = width - labelWidth - colGap;
						const columns = Math.max(4, Math.floor((available + gap) / (cell + gap)));
						setLayout({ columns, cell, gap });
					}
				};
				measure();
				const observer = new ResizeObserver(measure);
				observer.observe(el);
				return () => observer.disconnect();
			}, []);

			const { columns, cell, gap } = layout;
			const today = new Date();
			const dayOfWeek = (today.getDay() + 6) % 7;
			const totalDays = columns * 7 - (6 - dayOfWeek);
			const startDate = addCalendarDays(today, -(totalDays - 1));

			const monthMarkers = [];
			let lastMonth = -1;
			for (let c = 0; c < columns; c++) {
				const colDate = addCalendarDays(startDate, c * 7);
				const m = colDate.getMonth();
				if (m !== lastMonth && c > 0 && c < columns - 1) {
					monthMarkers.push({
						column: c,
						label: colDate.toLocaleString("default", { month: "short" })
					});
					lastMonth = m;
				}
			}

			const weeks = [];
			for (let c = 0; c < columns; c++) {
				const days = [];
				for (let r = 0; r < 7; r++) {
					const curDate = addCalendarDays(startDate, c * 7 + r);
					if (curDate > today) {
						days.push(jsx("div", { className: "dsh-git-cal-cell empty" }, "empty-" + c + "-" + r));
					} else {
						const key = calendarDateKey(curDate);
						const count = (contributions && contributions[key]) || 0;
						let level = 0;
						if (count >= 10) level = 4;
						else if (count >= 5) level = 3;
						else if (count >= 2) level = 2;
						else if (count >= 1) level = 1;
						days.push(jsx("div", {
							className: "dsh-git-cal-cell",
							"data-level": level > 0 ? String(level) : void 0,
							title: count + t("cal.commitsOn") + key
						}, key));
					}
				}
				weeks.push(jsx("div", { className: "dsh-git-cal-col", children: days }, "w" + c));
			}

			const weekdays = ["一", "", "三", "", "五", "", ""];

			return jsxs("div", {
				className: "dsh-git-cal",
				ref,
				children: [
					jsx("div", {
						className: "dsh-git-cal-months",
						children: monthMarkers.map((m) => jsx("span", {
							className: "dsh-git-cal-month",
							style: { left: (m.column * (cell + gap)) + "px" },
							children: m.label
						}, m.label + "-" + m.column))
					}),
					jsx("div", {
						className: "dsh-git-cal-weekdays",
						children: weekdays.map((day, i) => jsx("div", { className: "dsh-git-cal-weekday", children: day }, "d" + i))
					}),
					jsx("div", { className: "dsh-git-cal-weeks", children: weeks })
				]
			});
		}

		// ── 快捷启动卡片（固定在右侧，方块按钮：图标在上，文字在下）──────────
		function QuickActionsCard({ cwd, ideInfo, t, busy, onOpen, onOpenIde, onOpenFinder }) {
			if (!cwd || !canOpenLocally()) return null;
			const ideMeta = getIdeMeta(ideInfo);
			const actions = [
				{ key: "terminal", agent: null, label: t("quick.terminal"), icon: TERMINAL_ICON },
				{ key: "ide", isIde: true, label: ideMeta.label, icon: ideMeta.icon },
				{ key: "finder", isFinder: true, label: t("quick.finder"), icon: FINDER_ICON },
				{ key: "opencode", agent: "opencode", label: "OpenCode", icon: OPENCODE_ICON },
				{ key: "claude", agent: "claude", label: "Claude", icon: CLAUDE_ICON },
				{ key: "codex", agent: "codex", label: "Codex", icon: CODEX_ICON },
				{ key: "antigravity", agent: "antigravity", label: "Antigravity", icon: ANTIGRAVITY_ICON }
			];
			return jsx("div", {
				className: "dsh-git-card dsh-git-qa-card",
				children: jsx("div", {
					className: "dsh-git-card-b",
					children: jsx("div", {
						className: "dsh-git-qa-grid",
						children: actions.map((item) => jsxs("button", {
							type: "button",
							className: "dsh-git-qa-btn",
							title: item.label,
							disabled: busy,
							onClick: () => {
								if (item.isIde) onOpenIde(ideMeta.label);
								else if (item.isFinder) onOpenFinder();
								else onOpen(item);
							},
							children: [
								jsx("span", { className: "dsh-git-qa-icon", dangerouslySetInnerHTML: { __html: item.icon } }),
								jsx("span", { className: "dsh-git-qa-label", children: item.label })
							]
						}, item.key))
					})
				})
			});
		}

		// ── 提交详情弹窗 ───────────────────────────────────────────────
		function CommitDetailModal({ cwd, hash, commits, t, onClose }) {
			const [detail, setDetail] = useState(null);
			const [loading, setLoading] = useState(true);
			const [error, setError] = useState(null);
			const [copied, setCopied] = useState(false);

			useEffect(() => {
				if (!cwd || !hash) return;
				setLoading(true);
				setError(null);
				fetchJson("/dsh-git/commit-detail?cwd=" + encodeURIComponent(cwd) + "&hash=" + encodeURIComponent(hash))
					.then((data) => {
						setDetail(data);
						setLoading(false);
					})
					.catch((err) => {
						const fallback = (commits || []).find((c) => c.hash === hash || c.shortHash === hash);
						if (fallback) {
							setDetail({
								hash: fallback.hash,
								shortHash: fallback.shortHash,
								author: fallback.author,
								email: fallback.email || "",
								date: fallback.date,
								subject: fallback.subject,
								body: fallback.body || "",
								stat: ""
							});
							setLoading(false);
						} else {
							setError((err && err.message) || String(err));
							setLoading(false);
						}
					});
			}, [cwd, hash, commits]);

			useEffect(() => {
				const handleKeyDown = (e) => {
					if (e.key === "Escape") onClose();
				};
				window.addEventListener("keydown", handleKeyDown);
				return () => window.removeEventListener("keydown", handleKeyDown);
			}, [onClose]);

			const handleCopyHash = () => {
				if (!detail || !detail.hash) return;
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(detail.hash).then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					}).catch(() => {});
				}
			};

			return jsx("div", {
				className: "dsh-git-modal-overlay",
				onClick: (e) => {
					if (e.target === e.currentTarget) onClose();
				},
				children: jsxs("div", {
					className: "dsh-git-modal",
					role: "dialog",
					"aria-modal": "true",
					children: [
						jsxs("div", {
							className: "dsh-git-modal-h",
							children: [
								jsxs("div", {
									className: "dsh-git-modal-title",
									children: [
										jsx("span", { children: t("commit.detail") }),
										detail && jsx("span", { className: "dsh-git-log-hash", children: detail.shortHash })
									]
								}),
								jsx("button", {
									type: "button",
									className: "dsh-git-action",
									onClick: onClose,
									children: "✕"
								})
							]
						}),
						jsxs("div", {
							className: "dsh-git-modal-b",
							children: [
								loading && jsxs("div", {
									className: "dsh-git-muted",
									style: { display: "flex", alignItems: "center", gap: "8px" },
									children: [
										jsx("span", { className: "dsh-git-spinner" }),
										jsx("span", { children: t("loading") })
									]
								}),
								error && jsx("div", { className: "dsh-git-error", children: error }),
								detail && jsxs(Fragment, {
									children: [
										jsxs("div", {
											className: "dsh-git-kv",
											children: [
												jsx("span", { className: "dsh-git-kv-k", children: "Commit" }),
												jsxs("span", {
													className: "dsh-git-kv-v",
													style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
													children: [
														jsx("span", { children: detail.hash }),
														jsx("button", {
															type: "button",
															className: "dsh-git-action",
															onClick: handleCopyHash,
															children: copied ? t("commit.copied") : t("commit.copyHash")
														})
													]
												}),
												jsx("span", { className: "dsh-git-kv-k", children: t("author") }),
												jsx("span", { className: "dsh-git-kv-v", children: detail.author + (detail.email ? " <" + detail.email + ">" : "") }),
												jsx("span", { className: "dsh-git-kv-k", children: t("date") }),
												jsx("span", { className: "dsh-git-kv-v", children: detail.date })
											]
										}),
										jsxs("div", {
											children: [
												jsx("div", { className: "dsh-git-modal-section-title", children: t("commit.message") }),
												jsx("div", {
													className: "dsh-git-modal-msg",
													children: [detail.subject, detail.body ? "\n\n" + detail.body : ""].filter(Boolean).join("")
												})
											]
										}),
										detail.stat && jsxs("div", {
											children: [
												jsx("div", { className: "dsh-git-modal-section-title", children: t("commit.changes") }),
												jsx("pre", { className: "dsh-git-modal-stat", children: detail.stat })
											]
										})
									]
								})
							]
						})
					]
				})
			});
		}

		// ── 仓库概况卡片 ────────────────────────────────────────────────
		function RepoOverview({ info, branches, contributions, t, onSwitchBranch, busy, busyAction, busyText, notice, onClearNotice, onRefresh, onPush, onPull, canSync }) {
			const [menuOpen, setMenuOpen] = useState(false);
			const menuRef = useRef(null);

			useEffect(() => {
				const handleClickOutside = (e) => {
					if (menuRef.current && !menuRef.current.contains(e.target)) {
						setMenuOpen(false);
					}
				};
				const handleKeyDown = (e) => {
					if (e.key === "Escape") setMenuOpen(false);
				};
				document.addEventListener("click", handleClickOutside);
				document.addEventListener("keydown", handleKeyDown);
				return () => {
					document.removeEventListener("click", handleClickOutside);
					document.removeEventListener("keydown", handleKeyDown);
				};
			}, []);

			const branchList = (branches && branches.branches) || [];

			return jsxs("div", {
				className: "dsh-git-card dsh-git-overview-card",
				children: [
					jsxs("div", {
						className: "dsh-git-card-h",
						children: [
							jsxs("div", {
								style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 },
								children: [
									jsx("span", { children: t("repo.branch") + "：" }),
									jsxs("div", {
										className: "dsh-git-branch-selector-wrap",
										ref: menuRef,
										children: [
											jsxs("button", {
												type: "button",
												className: "dsh-git-branch-selector-btn" + (menuOpen ? " open" : ""),
												disabled: busy,
												onClick: (e) => {
													e.stopPropagation();
													setMenuOpen(!menuOpen);
												},
												title: t("action.switchBranch"),
												children: [
													busyAction === "switch" && jsx("span", { className: "dsh-git-spinner" }),
													jsx("span", { children: (busyAction === "switch" ? t("action.switching") : (info.branch || "—")) }),
													jsx("svg", {
														className: "dsh-git-branch-chevron",
														viewBox: "0 0 24 24",
														fill: "none",
														stroke: "currentColor",
														strokeWidth: "2.4",
														strokeLinecap: "round",
														strokeLinejoin: "round",
														children: jsx("polyline", { points: "6 9 12 15 18 9" })
													})
												]
											}),
											menuOpen && jsx("div", {
												className: "dsh-git-branch-menu",
												children: branchList.length > 0 ? branchList.map((b) => jsxs("button", {
													type: "button",
													className: "dsh-git-branch-item" + (b.current ? " current" : ""),
													onClick: () => {
														setMenuOpen(false);
														if (!b.current) onSwitchBranch(b.name);
													},
													children: [
														jsx("span", { children: b.current ? "✓" : " " }),
														jsx("span", { className: "dsh-git-branch-item-name", children: b.name }),
														b.upstream && jsx("span", { className: "dsh-git-branch-item-tag", children: "→ " + b.upstream })
													]
												}, b.name)) : jsx("div", { className: "dsh-git-muted", children: t("log.empty") })
											})
										]
									}),
									jsx("span", { style: { color: "var(--dsw-alias-label-tertiary)" }, children: "·" }),
									jsx("span", {
										style: { color: info.isDirty ? "var(--dsw-alias-state-warning-primary,#e8a33d)" : "var(--dsw-alias-state-success-primary,#3fb950)" },
										children: info.isDirty ? t("repo.dirty") : t("repo.clean")
									}),
									// 提示区显示到当前分支的title区，放到当前分支状态的后面
									busyText && jsxs("span", {
										className: "dsh-git-title-notice busy",
										children: [
											jsx("span", { className: "dsh-git-spinner" }),
											jsx("span", { children: busyText })
										]
									}),
									notice && jsxs("span", {
										className: "dsh-git-title-notice " + notice.kind,
										children: [
											jsx("span", { children: notice.message }),
											jsx("button", {
												type: "button",
												className: "dsh-git-title-notice-close",
												onClick: onClearNotice,
												children: "✕"
											})
										]
									})
								]
							})
						]
					}),
					jsx("div", {
						className: "dsh-git-card-b",
						children: jsxs("div", {
							className: "dsh-git-overview",
							children: [
								jsxs("div", {
									className: "dsh-git-overview-info",
									children: [
										jsxs("div", {
											className: "dsh-git-kv",
											children: [
												jsx("span", { className: "dsh-git-kv-k", children: t("repo.remote") }),
												jsx("span", { className: "dsh-git-kv-v dsh-git-clamp-2", title: info.remoteUrl || "", children: info.remoteUrl || "—" }),
												info.ahead !== null && jsxs(Fragment, { children: [
													jsx("span", { className: "dsh-git-kv-k", children: t("ahead") + " / " + t("behind") }),
													jsx("span", { className: "dsh-git-kv-v dsh-git-clamp-2", children: info.ahead + " / " + info.behind })
												] })
											]
										}),
										// 刷新、拉取与推送按钮组
										jsxs("div", {
											style: { marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
											children: [
												jsxs("button", {
													type: "button",
													className: "dsh-git-btn",
													disabled: busy,
													onClick: onRefresh,
													children: [
														busyAction === "load" && jsx("span", { className: "dsh-git-spinner" }),
														jsx("span", { children: busyAction === "load" ? t("action.refreshing") : t("toolbar.refresh") })
													]
												}),
												canSync && jsxs("button", {
													type: "button",
													className: "dsh-git-btn",
													disabled: busy,
													onClick: onPull,
													children: [
														busyAction === "pull" && jsx("span", { className: "dsh-git-spinner" }),
														jsx("span", { children: busyAction === "pull" ? t("action.pulling") : t("action.pull") })
													]
												}),
												canSync && jsxs("button", {
													type: "button",
													className: "dsh-git-btn",
													disabled: busy,
													onClick: onPush,
													children: [
														busyAction === "push" && jsx("span", { className: "dsh-git-spinner" }),
														jsx("span", { children: busyAction === "push" ? t("action.pushing") : t("action.push") })
													]
												})
											]
										})
									]
								}),
								jsx("div", {
									className: "dsh-git-overview-cal",
									children: jsx(ContributionCalendar, { contributions, t })
								})
							]
						})
					})
				]
			});
		}

		// ── 文件查看视图（复用 gmc 文件预览：代码行号、图片预览、复制、面包屑导航）──
		function FileViewCard({ cwd, filePath, t, onBack, onOpenIde }) {
			const [fileData, setFileData] = useState(null);
			const [loading, setLoading] = useState(true);
			const [error, setError] = useState(null);
			const [copied, setCopied] = useState(false);
			const [copiedPath, setCopiedPath] = useState(false);

			useEffect(() => {
				if (!cwd || !filePath) return;
				setLoading(true);
				setError(null);
				fetchJson("/dsh-git/file?cwd=" + encodeURIComponent(cwd) + "&path=" + encodeURIComponent(filePath))
					.then((data) => {
						setFileData(data);
						setLoading(false);
					})
					.catch((err) => {
						setError((err && err.message) || String(err));
						setLoading(false);
					});
			}, [cwd, filePath]);

			const lines = useMemo(() => {
				if (!fileData || fileData.binary || !fileData.content) return [];
				const raw = fileData.content.split(/\r?\n/);
				if (raw.length > 1 && raw[raw.length - 1] === "") raw.pop();
				return raw.length ? raw : [""];
			}, [fileData]);

			const handleCopyContent = () => {
				if (!fileData || fileData.binary || !fileData.content) return;
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(fileData.content).then(() => {
						setCopied(true);
						setTimeout(() => setCopied(false), 2000);
					}).catch(() => {});
				}
			};

			const handleCopyPath = () => {
				if (!filePath) return;
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(filePath).then(() => {
						setCopiedPath(true);
						setTimeout(() => setCopiedPath(false), 2000);
					}).catch(() => {});
				}
			};

			const pathParts = useMemo(() => {
				return String(filePath || "").split("/").filter(Boolean);
			}, [filePath]);

			return jsxs("div", {
				className: "dsh-git-card dsh-git-fileview",
				children: [
					// 面包屑导航 + 返回按钮
					jsxs("div", {
						className: "dsh-git-breadcrumb",
						children: [
							jsx("button", {
								type: "button",
								className: "dsh-git-breadcrumb-btn",
								onClick: onBack,
								children: "← " + t("file.back")
							}),
							jsx("span", { children: "/" }),
							pathParts.map((part, idx) => {
								const isLast = idx === pathParts.length - 1;
								return jsxs(Fragment, {
									children: [
										isLast ? jsx("span", { className: "dsh-git-breadcrumb-current", children: part }) : jsx("span", { children: part }),
										!isLast && jsx("span", { children: "/" })
									]
								}, "part-" + idx);
							})
						]
					}),
					// 文件头：名称、大小、语言、复制操作
					jsxs("div", {
						className: "dsh-git-fileview-header",
						children: [
							jsxs("div", {
								className: "dsh-git-fileview-title-group",
								children: [
									jsx("span", { className: "dsh-git-file-icon", dangerouslySetInnerHTML: { __html: FILE_ICON } }),
									jsx("span", { className: "dsh-git-fileview-title", children: fileData ? fileData.name : filePath }),
									fileData && jsxs("div", {
										className: "dsh-git-fileview-meta",
										children: [
											fileData.language && jsx("span", { className: "dsh-git-fileview-tag", children: fileData.language }),
											jsx("span", { children: formatSize(fileData.size) }),
											!fileData.binary && jsx("span", { children: lines.length + " " + t("lines") }),
											fileData.truncated && jsx("span", { className: "dsh-git-badge ren", children: t("file.large") })
										]
									})
								]
							}),
							jsxs("div", {
								className: "dsh-git-fileview-actions",
								children: [
									jsx("button", {
										type: "button",
										className: "dsh-git-action",
										onClick: handleCopyPath,
										children: copiedPath ? t("file.copied") : t("file.copyPath")
									}),
									fileData && !fileData.binary && jsx("button", {
										type: "button",
										className: "dsh-git-action",
										onClick: handleCopyContent,
										children: copied ? t("file.copied") : t("file.copyContent")
									})
								]
							})
						]
					}),
					// 内容区域
					loading && jsxs("div", {
						className: "dsh-git-muted",
						style: { display: "flex", alignItems: "center", gap: "8px", padding: "20px 14px" },
						children: [
							jsx("span", { className: "dsh-git-spinner" }),
							jsx("span", { children: t("loadingFile") })
						]
					}),
					error && jsxs("div", {
						className: "dsh-git-error",
						style: { padding: "16px" },
						children: [
							jsx("span", { children: t("file.loadFailed") + ": " + error }),
							jsx("button", {
								type: "button",
								className: "dsh-git-action",
								onClick: () => {
									setLoading(true);
									setError(null);
									fetchJson("/dsh-git/file?cwd=" + encodeURIComponent(cwd) + "&path=" + encodeURIComponent(filePath))
										.then((data) => { setFileData(data); setLoading(false); })
										.catch((err) => { setError((err && err.message) || String(err)); setLoading(false); });
								},
								children: t("retry")
							})
						]
					}),
					!loading && !error && fileData && jsxs(Fragment, {
						children: [
							fileData.dataUrl ? jsx("div", {
								className: "dsh-git-image-preview",
								children: jsx("img", { src: fileData.dataUrl, alt: fileData.name })
							}) : fileData.binary ? jsx("div", {
								className: "dsh-git-binary-notice",
								children: t("file.binary")
							}) : jsx("div", {
								className: "dsh-git-code-view",
								children: lines.map((line, idx) => jsxs("div", {
									className: "dsh-git-code-line",
									children: [
										jsx("span", { className: "dsh-git-code-line-no", children: idx + 1 }),
										jsx("span", { className: "dsh-git-code-line-text", children: line || " " })
									]
								}, "line-" + idx))
							})
						]
					})
				]
			});
		}

		// ── 工作区文件列表卡片（可查看所有文件与变更文件，点击文件进入查看视图）─
		function WorkspaceFilesCard({ workspaceData, statusData, t, onSelectFile, onStage, onUnstage, busy, busyAction }) {
			const [tab, setTab] = useState("all"); // "all" | "changed"
			const [search, setSearch] = useState("");

			const allFiles = (workspaceData && workspaceData.files) || (statusData && statusData.files) || [];
			const changedFiles = (statusData && statusData.files) || [];

			const stageable = useMemo(() => {
				return changedFiles.filter((f) => f.gitPath && f.worktree !== " ");
			}, [changedFiles]);

			const displayList = useMemo(() => {
				const base = tab === "changed" ? changedFiles : allFiles;
				if (!search.trim()) return base;
				const q = search.trim().toLowerCase();
				return base.filter((f) => f.path.toLowerCase().includes(q));
			}, [tab, allFiles, changedFiles, search]);

			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					// 标题与切换 Tab
					jsxs("div", {
						className: "dsh-git-card-h",
						children: [
							jsxs("div", {
								style: { display: "flex", alignItems: "center", gap: "8px" },
								children: [
									jsx("span", { children: t("files.workspace") }),
									jsxs("div", {
										className: "dsh-git-filetabs",
										children: [
											jsxs("button", {
												type: "button",
												className: "dsh-git-filetab" + (tab === "all" ? " active" : ""),
												onClick: () => setTab("all"),
												children: [t("files.all"), " (", allFiles.length, ")"]
											}),
											jsxs("button", {
												type: "button",
												className: "dsh-git-filetab" + (tab === "changed" ? " active" : ""),
												onClick: () => setTab("changed"),
												children: [t("files.changed"), " (", changedFiles.length, ")"]
											})
										]
									})
								]
							}),
							stageable.length > 0 && jsxs("button", {
								type: "button",
								className: "dsh-git-action",
								disabled: busy,
								onClick: () => onStage(stageable.map((file) => file.gitPath)),
								children: [
									busyAction === "stage" && jsx("span", { className: "dsh-git-spinner" }),
									jsx("span", { children: (busyAction === "stage" ? t("action.staging") : t("action.stageAll") + " (" + stageable.length + ")") })
								]
							})
						]
					}),
					// 实时搜索框
					jsx("div", {
						className: "dsh-git-search-wrap",
						children: jsx("input", {
							className: "dsh-git-search-input",
							type: "search",
							value: search,
							placeholder: t("files.search"),
							onChange: (e) => setSearch(e.target.value)
						})
					}),
					// 文件列表
					jsx("div", {
						className: "dsh-git-filelist-wrap",
						children: displayList.length === 0 ? jsx("div", {
							className: "dsh-git-muted",
							style: { padding: "16px 14px" },
							children: search.trim() ? t("files.emptySearch") : (tab === "changed" ? t("files.empty") : t("files.emptyWorkspace"))
						}) : displayList.map((file) => jsxs("div", {
							className: "dsh-git-file-row",
							onClick: () => onSelectFile(file.path),
							title: file.path,
							children: [
								file.status ? (
									file.status[0] !== " " && file.status[1] !== " " ? jsxs(Fragment, {
										children: [statusBadge(file.status[0]), statusBadge(file.status[1])]
									}) : statusBadge(file.status[0] === " " ? file.status[1] : file.status[0])
								) : jsx("span", { className: "dsh-git-file-icon", dangerouslySetInnerHTML: { __html: FILE_ICON } }),
								jsx("span", { className: "dsh-git-file-name" + (file.status && file.status[1] === "R" ? " renamed" : ""), children: file.path }),
								jsx("span", { className: "dsh-git-file-size", children: formatSize(file.size) }),
								file.gitPath && file.worktree !== " " && jsx("button", {
									type: "button",
									className: "dsh-git-action",
									disabled: busy,
									onClick: (e) => {
										e.stopPropagation();
										onStage([file.gitPath]);
									},
									children: t("action.stage")
								}),
								file.gitPath && file.index !== " " && file.index !== "?" && jsx("button", {
									type: "button",
									className: "dsh-git-action",
									disabled: busy,
									onClick: (e) => {
										e.stopPropagation();
										onUnstage([file.gitPath]);
									},
									children: t("action.unstage")
								})
							]
						}, file.path))
					})
				]
			});
		}

		// ── 提交卡片 ────────────────────────────────────────────────────
		function CommitCard({ files, t, onCommit, busy, busyAction }) {
			const stagedCount = files ? files.filter((file) => file.index !== " " && file.index !== "?").length : 0;
			const [message, setMessage] = React.useState("");
			const hasCustomMessage = message.trim() !== "";

			const handleCommit = () => {
				if (stagedCount === 0 || busy) return;
				const msg = hasCustomMessage ? message.trim() : "gmc";
				onCommit(msg);
				setMessage("");
			};

			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsxs("div", {
						className: "dsh-git-card-h",
						children: [
							jsx("span", { children: t("action.commit") }),
							jsxs("div", {
								style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
								children: [
									jsx("span", {
										className: "dsh-git-muted",
										style: { fontSize: "11px", padding: 0 },
										children: t("commit.gmcTip")
									}),
									jsx("span", { className: "dsh-git-staged-count", children: t("commit.stagedCount") + stagedCount + t("commit.files") })
								]
							})
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
									if (event.key === "Enter" && !event.shiftKey && stagedCount > 0 && !busy) {
										handleCommit();
									}
								}
							}),
							jsxs("button", {
								type: "button",
								className: "dsh-git-btn dsh-git-btn-primary",
								disabled: busy || stagedCount === 0,
								onClick: handleCommit,
								children: [
									busyAction === "commit" && jsx("span", { className: "dsh-git-spinner" }),
									jsx("span", { children: busyAction === "commit" ? t("action.committing") : (hasCustomMessage ? t("action.commit") : t("commit.gmcAuto")) })
								]
							})
						]
					})
				]
			});
		}

		// ── 提交历史卡片（固定在右侧）───────────────────────────────────
		function CommitList({ commits, t, onSelectCommit }) {
			if (!commits || commits.length === 0) return jsx("div", { className: "dsh-git-muted", children: t("log.empty") });
			return jsxs("div", {
				className: "dsh-git-card",
				children: [
					jsx("div", { className: "dsh-git-card-h", children: t("log.title") + " (" + commits.length + ")" }),
					jsx("div", {
						className: "dsh-git-log",
						children: commits.map((commit) => jsxs("div", {
							className: "dsh-git-log-row",
							onClick: () => onSelectCommit(commit.hash),
							title: t("commit.detail"),
							children: [
								jsx("div", { className: "dsh-git-log-subject", children: commit.subject || "—" }),
								jsxs("div", {
									className: "dsh-git-log-meta",
									children: [
										jsx("span", { className: "dsh-git-log-hash", children: commit.shortHash }),
										jsx("span", { children: "·" }),
										jsx("span", { children: commit.author }),
										jsx("span", { children: "·" }),
										jsx("span", { children: commit.date })
									]
								})
							]
						}, commit.hash))
					})
				]
			});
		}

		// ── 主页面容器 ─────────────────────────────────────────────────
		function GitView({ sessionId, useSessions, t, onClose }) {
			const cwd = useSessions((s) => (s && s.byId && s.byId[sessionId] && s.byId[sessionId].cwd) || null);
			const [view, setView] = useState({ kind: "loading" });
			const [busy, setBusy] = useState(false);
			const [busyAction, setBusyAction] = useState(null);
			const [busyText, setBusyText] = useState(null);
			const [notice, setNotice] = useState(null);
			const [selectedCommitHash, setSelectedCommitHash] = useState(null);
			const [selectedFilePath, setSelectedFilePath] = useState(null);

			const load = useCallback((isManualRefresh) => {
				if (!cwd) {
					setView({ kind: "error", message: t("no.cwd") });
					return Promise.resolve();
				}
				if (isManualRefresh) {
					setBusy(true);
					setBusyAction("load");
					setBusyText(t("action.refreshing"));
				} else {
					setView({ kind: "loading" });
				}
				const query = "cwd=" + encodeURIComponent(cwd);
				return Promise.all([
					fetchJson("/dsh-git/info?" + query),
					fetchJson("/dsh-git/status?" + query),
					fetchJson("/dsh-git/workspace-files?" + query),
					fetchJson("/dsh-git/log?" + query),
					fetchJson("/dsh-git/branches?" + query),
					fetchJson("/dsh-git/contributions?" + query)
				]).then(([info, status, workspaceFiles, log, branches, contributions]) => {
					setView({ kind: "data", info, status, workspaceFiles, log, branches, contributions });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				}).catch((err) => {
					setView({ kind: "error", message: (err && err.message) || String(err) });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				});
			}, [cwd, t]);

			useEffect(() => {
				load(false);
			}, [load]);

			/** 执行一个 git 操作：POST → 提示结果 → 刷新。 */
			const runAction = useCallback((actionKey, actionLabel, endpoint, payload, okMessage) => {
				if (!cwd || busy) return;
				setBusy(true);
				setBusyAction(actionKey);
				setBusyText(actionLabel);
				setNotice(null);
				fetchJson(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(Object.assign({ cwd }, payload))
				}).then((result) => {
					setNotice({ kind: "ok", message: okMessage(result) });
					return load(false);
				}).then(() => {
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				}).catch((err) => {
					setNotice({ kind: "error", message: t("action.failed") + ": " + ((err && err.message) || String(err)) });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				});
			}, [cwd, busy, load, t]);

			const stage = useCallback((paths) => {
				runAction("stage", t("action.staging"), "/dsh-git/stage", { paths }, (result) => t("notice.staged") + (result.staged ? result.staged.length : 0) + t("commit.files"));
			}, [runAction, t]);

			const unstage = useCallback((paths) => {
				runAction("unstage", t("action.unstaging"), "/dsh-git/unstage", { paths }, (result) => t("notice.unstaged") + (result.unstaged ? result.unstaged.length : 0) + t("commit.files"));
			}, [runAction, t]);

			const commit = useCallback((message) => {
				runAction("commit", t("action.committing"), "/dsh-git/commit", { message }, () => t("notice.committed"));
			}, [runAction, t]);

			const push = useCallback(() => {
				runAction("push", t("action.pushing"), "/dsh-git/push", {}, () => t("notice.pushed"));
			}, [runAction, t]);

			const pull = useCallback(() => {
				runAction("pull", t("action.pulling"), "/dsh-git/pull", {}, () => t("notice.pulled"));
			}, [runAction, t]);

			const switchBranch = useCallback((branch) => {
				runAction("switch", t("action.switching") + " " + branch, "/dsh-git/checkout", { branch }, () => t("notice.switched") + branch);
			}, [runAction, t]);

			const init = useCallback(() => {
				if (!cwd || busy) return;
				setBusy(true);
				setBusyAction("init");
				setBusyText(t("init.running"));
				setNotice(null);
				fetchJson("/dsh-git/init", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ cwd })
				}).then(() => {
					setNotice({ kind: "ok", message: t("notice.committed") });
					return load(false);
				}).then(() => {
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				}).catch((err) => {
					setNotice({ kind: "error", message: t("action.failed") + ": " + ((err && err.message) || String(err)) });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				});
			}, [cwd, busy, load, t]);

			/** 打开终端 / 启动代理 / Finder / IDE：POST → 提示结果。 */
			const postQuick = useCallback((endpoint, payload, okMessage) => {
				if (!cwd || busy) return;
				setBusy(true);
				setBusyAction("open");
				setBusyText(okMessage);
				setNotice(null);
				fetchJson(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(Object.assign({ cwd }, payload))
				}).then(() => {
					setNotice({ kind: "ok", message: okMessage });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				}).catch((err) => {
					setNotice({ kind: "error", message: t("action.failed") + ": " + ((err && err.message) || String(err)) });
					setBusy(false);
					setBusyAction(null);
					setBusyText(null);
				});
			}, [cwd, busy, t]);

			const openQuick = useCallback((item) => {
				postQuick(item.agent ? "/dsh-git/open-agent" : "/dsh-git/open-terminal", item.agent ? { agent: item.agent } : {}, item.agent ? t("quick.launched") + item.label : t("quick.openedTerminal"));
			}, [postQuick, t]);

			const openFinder = useCallback(() => {
				postQuick("/dsh-git/open-finder", {}, t("quick.revealFinder"));
			}, [postQuick, t]);

			const openIde = useCallback((label) => {
				postQuick("/dsh-git/open-ide", {}, t("quick.openedIde") + (label || "IDE"));
			}, [postQuick, t]);

			return jsxs("div", {
				className: "dsh-git",
				children: [
					// 顶部工具栏（标题与路径）
					jsxs("div", {
						className: "dsh-git-toolbar",
						children: [
							onClose && jsx("button", {
								type: "button",
								className: "dsh-git-btn",
								style: { marginRight: "4px" },
								onClick: onClose,
								children: "← " + t("file.back")
							}),
							jsx("span", { className: "dsh-git-title", children: t("view.git") }),
							cwd && jsx("span", { className: "dsh-git-path", title: t("quick.revealFinder"), onClick: openFinder, children: cwd })
						]
					}),
					// 非 repo 场景下的提示条
					view.kind === "data" && !view.info.isRepo && notice && jsxs("div", {
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
							jsx("button", { type: "button", className: "dsh-git-btn", onClick: () => load(true), children: t("retry") })
						]
					}),
					view.kind === "data" && jsxs("div", {
						className: "dsh-git-grid",
						children: [
							// 左侧：当前分支与仓库概况 + 工作区文件浏览/查看 + 提交卡片
							jsxs("div", {
								className: "dsh-git-col",
								children: [
									!view.info.isRepo && jsxs("div", {
										className: "dsh-git-banner",
										children: [
											jsx("span", { children: t("notRepo") }),
											jsxs("button", {
												type: "button",
												className: "dsh-git-btn dsh-git-btn-primary",
												disabled: busy,
												onClick: init,
												children: [
													busyAction === "init" && jsx("span", { className: "dsh-git-spinner" }),
													jsx("span", { children: busyAction === "init" ? t("init.running") : t("init") })
												]
											})
										]
									}),
									view.info.isRepo && jsx(RepoOverview, {
										info: view.info,
										branches: view.branches,
										contributions: view.contributions,
										t,
										onSwitchBranch: switchBranch,
										busy,
										busyAction,
										busyText,
										notice,
										onClearNotice: () => setNotice(null),
										onRefresh: () => load(true),
										onPush: push,
										onPull: pull,
										canSync: !!view.info.remoteUrl
									}),
									selectedFilePath ? jsx(FileViewCard, {
										cwd,
										filePath: selectedFilePath,
										t,
										onBack: () => setSelectedFilePath(null),
										onOpenIde: openIde
									}) : jsx(WorkspaceFilesCard, {
										workspaceData: view.workspaceFiles,
										statusData: view.status,
										t,
										onSelectFile: (p) => setSelectedFilePath(p),
										onStage: stage,
										onUnstage: unstage,
										busy,
										busyAction
									}),
									view.info.isRepo && jsx(CommitCard, {
										files: view.status.files,
										t,
										onCommit: commit,
										busy,
										busyAction
									})
								]
							}),
							// 右侧：快捷启动独立区域（方块按钮，顶在最上方） + 提交历史
							jsxs("div", {
								className: "dsh-git-col",
								children: [
									jsx(QuickActionsCard, {
										cwd,
										ideInfo: view.info.ide,
										t,
										busy,
										onOpen: openQuick,
										onOpenIde: openIde,
										onOpenFinder: openFinder
									}),
									view.info.isRepo && jsx(CommitList, {
										commits: view.log.commits,
										t,
										onSelectCommit: setSelectedCommitHash
									})
								]
							})
						]
					}),
					selectedCommitHash && jsx(CommitDetailModal, {
						cwd,
						hash: selectedCommitHash,
						commits: view.kind === "data" ? view.log.commits : [],
						t,
						onClose: () => setSelectedCommitHash(null)
					})
				]
			});
		}

		// ── 空白会话首页 Hero 概况卡片（在 conversation.input.dock 渲染并通过 Portal 挂载到顶部）─────
		function GitHeroDock({ sessionId, useSession, useSessions, t }) {
			const order = useSession ? useSession((s) => (s && s.chat && s.chat.order) || []) : [];
			const sessionCwd = useSession ? useSession((s) => s && s.cwd) : null;
			const sessionsCwd = useSessions ? useSessions((s) => (s && s.byId && s.byId[sessionId] && s.byId[sessionId].cwd) || (s && s.activeId && s.byId && s.byId[s.activeId] && s.byId[s.activeId].cwd) || null) : null;
			const cwd = sessionCwd || sessionsCwd;

			const [showFullGit, setShowFullGit] = useState(false);
			const [branchMenuOpen, setBranchMenuOpen] = useState(false);
			const branchMenuRef = useRef(null);
			const [scrollEl, setScrollEl] = useState(null);

			// 只有新会话（没有任何历史消息时）才渲染 Hero 概况卡片，一旦开始对话自动隐藏
			if (order.length > 0) return null;

			useEffect(() => {
				const findContainer = () => {
					const el = document.querySelector("[data-conversation-scroll]");
					if (el) setScrollEl(el);
				};
				findContainer();
				const timer1 = setTimeout(findContainer, 50);
				const timer2 = setTimeout(findContainer, 150);
				const timer3 = setTimeout(findContainer, 400);
				return () => {
					clearTimeout(timer1);
					clearTimeout(timer2);
					clearTimeout(timer3);
				};
			}, [sessionId, cwd]);

			const [data, setData] = useState({ kind: "loading" });
			const [busy, setBusy] = useState(false);

			const load = useCallback(() => {
				if (!cwd) {
					setData({ kind: "error", message: t("no.cwd") });
					return;
				}
				setData({ kind: "loading" });
				const query = "cwd=" + encodeURIComponent(cwd);
				Promise.all([
					fetchJson("/dsh-git/info?" + query),
					fetchJson("/dsh-git/branches?" + query),
					fetchJson("/dsh-git/contributions?" + query)
				]).then(([info, branches, contributions]) => {
					setData({ kind: "data", info, branches, contributions });
				}).catch((err) => {
					setData({ kind: "error", message: (err && err.message) || String(err) });
				});
			}, [cwd, t]);

			useEffect(() => {
				load();
			}, [load]);

			useEffect(() => {
				const handleClickOutside = (e) => {
					if (branchMenuRef.current && !branchMenuRef.current.contains(e.target)) {
						setBranchMenuOpen(false);
					}
				};
				document.addEventListener("click", handleClickOutside);
				return () => document.removeEventListener("click", handleClickOutside);
			}, []);

			const postQuick = useCallback((endpoint, payload) => {
				if (!cwd || busy) return;
				setBusy(true);
				fetchJson(endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(Object.assign({ cwd }, payload))
				}).finally(() => {
					setBusy(false);
				});
			}, [cwd, busy]);

			const openQuick = useCallback((item) => {
				postQuick(item.agent ? "/dsh-git/open-agent" : "/dsh-git/open-terminal", item.agent ? { agent: item.agent } : {});
			}, [postQuick]);

			const openFinder = useCallback(() => {
				postQuick("/dsh-git/open-finder", {});
			}, [postQuick]);

			const openIde = useCallback(() => {
				postQuick("/dsh-git/open-ide", {});
			}, [postQuick]);

			const initRepo = useCallback(() => {
				if (!cwd || busy) return;
				setBusy(true);
				fetchJson("/dsh-git/init", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ cwd })
				}).then(() => {
					return load();
				}).finally(() => {
					setBusy(false);
				});
			}, [cwd, busy, load]);

			const switchBranch = useCallback((branchName) => {
				if (!cwd || busy) return;
				setBusy(true);
				fetchJson("/dsh-git/checkout", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ cwd, branch: branchName })
				}).then(() => {
					return load();
				}).finally(() => {
					setBusy(false);
				});
			}, [cwd, busy, load]);

			if (!cwd) return null;

			let targetEl = scrollEl;
			if (typeof document !== "undefined") {
				if (!targetEl || !targetEl.isConnected) {
					targetEl = document.querySelector("[data-conversation-scroll]");
				}
			}

			// 点击进入完整 Git 管理界面：渲染只覆盖会话区域的完整管理视图（不遮挡左侧栏）
			if (showFullGit) {
				const fullView = jsx("div", {
					className: "dsh-git-fullscreen-view",
					children: jsx(GitView, {
						sessionId,
						useSessions,
						t,
						onClose: () => setShowFullGit(false)
					})
				});
				if (targetEl && targetEl.isConnected) return createPortal(fullView, targetEl);
				return fullView;
			}

			let heroBody = null;
			if (data.kind === "loading") {
				heroBody = jsxs("div", {
					className: "dsh-git-hero",
					children: [
						jsxs("div", {
							className: "dsh-git-hero-card dsh-git-hero-wide",
							children: [
								jsx("div", { className: "dsh-git-hero-card-h", children: jsx("span", { className: "dsh-git-title", children: t("view.git") }) }),
								jsxs("div", {
									className: "dsh-git-muted",
									style: { padding: "24px 18px", display: "flex", alignItems: "center", gap: "8px" },
									children: [
										jsx("span", { className: "dsh-git-spinner" }),
										jsx("span", { children: t("loading") })
									]
								})
							]
						})
					]
				});
			} else if (data.kind === "error") {
				heroBody = jsxs("div", {
					className: "dsh-git-hero",
					children: [
						jsxs("div", {
							className: "dsh-git-hero-card dsh-git-hero-wide",
							children: [
								jsx("div", { className: "dsh-git-hero-card-h", children: jsx("span", { className: "dsh-git-title", children: t("view.git") }) }),
								jsxs("div", {
									className: "dsh-git-error",
									style: { padding: "16px 18px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
									children: [
										jsx("span", { children: data.message }),
										jsx("button", { type: "button", className: "dsh-git-btn", onClick: load, children: t("retry") })
									]
								})
							]
						})
					]
				});
			} else {
				const { info, branches, contributions } = data;
				const branchList = (branches && branches.branches) || [];

				if (!info.isRepo) {
					heroBody = jsxs("div", {
						className: "dsh-git-hero",
						children: [
							jsxs("div", {
								className: "dsh-git-hero-card",
								children: [
									jsxs("div", {
										className: "dsh-git-hero-card-h",
										children: [
											jsx("span", { className: "dsh-git-hero-meta", children: t("hero.notRepo") }),
											jsx("button", {
												type: "button",
												className: "dsh-git-hero-btn-nav",
												title: t("hero.fullGitTip"),
												onClick: () => setShowFullGit(true),
												children: t("hero.openFull")
											})
										]
									}),
									jsx("div", {
										className: "dsh-git-hero-card-b",
										children: jsxs("div", {
											style: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" },
											children: [
												jsx("div", { className: "dsh-git-muted", children: t("hero.initTip") }),
												jsxs("button", {
													type: "button",
													className: "dsh-git-btn dsh-git-btn-primary",
													disabled: busy,
													onClick: initRepo,
													children: [
														busy && jsx("span", { className: "dsh-git-spinner" }),
														jsx("span", { children: busy ? t("init.running") : t("init") })
													]
												})
											]
										})
									})
								]
							}),
							jsx(QuickActionsCard, {
								cwd,
								ideInfo: info.ide,
								t,
								busy,
								onOpen: openQuick,
								onOpenIde: openIde,
								onOpenFinder: openFinder
							})
						]
					});
				} else {
					// 仓库概况卡片：左 repo 信息（本地地址可点击打开 Finder），右贡献日历
					heroBody = jsxs("div", {
						className: "dsh-git-hero",
						children: [
							jsxs("div", {
								className: "dsh-git-hero-card",
								children: [
									jsxs("div", {
										className: "dsh-git-hero-card-h",
										children: [
											jsxs("div", {
												style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 },
												children: [
													jsxs("div", {
														className: "dsh-git-branch-selector-wrap",
														ref: branchMenuRef,
														children: [
															jsxs("button", {
																type: "button",
																className: "dsh-git-branch-selector-btn" + (branchMenuOpen ? " open" : ""),
																disabled: busy,
																onClick: (e) => {
																	e.stopPropagation();
																	setBranchMenuOpen(!branchMenuOpen);
																},
																title: t("action.switchBranch"),
																children: [
																	jsx("svg", {
																		className: "dsh-git-branch-chevron",
																		style: { width: "13px", height: "13px", flex: "none" },
																		viewBox: "0 0 24 24",
																		fill: "none",
																		stroke: "currentColor",
																		strokeWidth: "2",
																		strokeLinecap: "round",
																		strokeLinejoin: "round",
																		children: jsxs(Fragment, { children: [
																			jsx("line", { x1: "6", y1: "3", x2: "6", y2: "15" }),
																			jsx("circle", { cx: "18", cy: "6", r: "3" }),
																			jsx("circle", { cx: "6", cy: "18", r: "3" }),
																			jsx("path", { d: "M18 9a9 9 0 0 1-9 9" })
																		] })
																	}),
																	jsx("span", { children: info.branch || "—" }),
																	jsx("svg", {
																		className: "dsh-git-branch-chevron",
																		viewBox: "0 0 24 24",
																		fill: "none",
																		stroke: "currentColor",
																		strokeWidth: "2.4",
																		strokeLinecap: "round",
																		strokeLinejoin: "round",
																		children: jsx("polyline", { points: "6 9 12 15 18 9" })
																	})
																]
															}),
															branchMenuOpen && jsx("div", {
																className: "dsh-git-branch-menu",
																children: branchList.length > 0 ? branchList.map((b) => jsxs("button", {
																	type: "button",
																	className: "dsh-git-branch-item" + (b.current ? " current" : ""),
																	onClick: () => {
																		setBranchMenuOpen(false);
																		if (!b.current) switchBranch(b.name);
																	},
																	children: [
																		jsx("span", { children: b.current ? "✓" : " " }),
																		jsx("span", { className: "dsh-git-branch-item-name", children: b.name }),
																		b.upstream && jsx("span", { className: "dsh-git-branch-item-tag", children: "→ " + b.upstream })
																	]
																}, b.name)) : jsx("div", { className: "dsh-git-muted", children: t("log.empty") })
															})
														]
													}),
													jsx("span", { style: { color: "var(--dsw-alias-label-tertiary)" }, children: "·" }),
													jsxs("span", {
														className: "dsh-git-hero-status" + (info.isDirty ? " dirty" : " clean"),
														children: [
															jsx("span", { className: "dsh-git-hero-status-dot" }),
															jsx("span", { children: info.isDirty ? t("repo.dirty") : t("repo.clean") })
														]
													})
												]
											}),
											jsx("button", {
												type: "button",
												className: "dsh-git-hero-btn-nav",
												title: t("hero.fullGitTip"),
												onClick: () => setShowFullGit(true),
												children: t("hero.openFull")
											})
										]
									}),
									jsx("div", {
										className: "dsh-git-hero-card-b",
										children: jsxs("div", {
											className: "dsh-git-overview",
											children: [
												// 左：repo 信息（本地地址点击打开 Finder；远端、领先/落后最多两行省略）
												jsxs("div", {
													className: "dsh-git-overview-info",
													children: [
														jsxs("div", {
															className: "dsh-git-kv",
															children: [
																jsx("span", { className: "dsh-git-kv-k", children: t("repo.local") }),
																jsx("span", {
																	className: "dsh-git-kv-v",
																	children: jsx("button", {
																		type: "button",
																		className: "dsh-git-path-btn",
																		title: t("quick.revealFinder") + ": " + (info.root || info.cwd),
																		onClick: openFinder,
																		children: [
																			jsx("svg", {
																				viewBox: "0 0 24 24",
																				fill: "none",
																				stroke: "currentColor",
																				strokeWidth: "2",
																				strokeLinecap: "round",
																				strokeLinejoin: "round",
																				children: jsx("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" })
																			}),
																			jsx("span", { children: info.root || info.cwd })
																		]
																	})
																}),
																jsx("span", { className: "dsh-git-kv-k", children: t("repo.remote") }),
																jsx("span", { className: "dsh-git-kv-v dsh-git-clamp-2", title: info.remoteUrl || "", children: info.remoteUrl || "—" }),
																info.ahead !== null && jsxs(Fragment, { children: [
																	jsx("span", { className: "dsh-git-kv-k", children: t("ahead") + " / " + t("behind") }),
																	jsx("span", { className: "dsh-git-kv-v dsh-git-clamp-2", children: info.ahead + " / " + info.behind })
																] })
															]
														})
													]
												}),
												// 右：贡献日历
												jsx("div", {
													className: "dsh-git-overview-cal",
													children: jsx(ContributionCalendar, { contributions, t })
												})
											]
										})
									})
								]
							}),
							// 快捷启动卡片（与 git tab 的快捷启动区域完全一致）
							jsx(QuickActionsCard, {
								cwd,
								ideInfo: info.ide,
								t,
								busy,
								onOpen: openQuick,
								onOpenIde: openIde,
								onOpenFinder: openFinder
							})
						]
					});
				}
			}

			if (targetEl && targetEl.isConnected) {
				return createPortal(heroBody, targetEl);
			}
			return heroBody;
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
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "git-hero",
				order: -50,
				locale: NS
			}, GitHeroDock));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
