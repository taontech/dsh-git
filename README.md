# @taontech/dsh-git —— DeepSeek Harness 的 Git tab 插件
![screen](https://raw.githubusercontent.com/taontech/dsh-git/76047d87cc66a061168cff7e29981febfbf57193/empty.png)

在 DSH 的会话界面（chat / Trajectory 之后）新增一个 **Git** tab，展示当前
项目路径的 Git 信息：仓库概况、文件修改状态、提交历史、分支与提交图、
贡献日历（最近一年每日提交热力图），以及暂存/提交/推送/拉取/切换分支等
操作；非 Git 目录则显示文件列表并支持一键 `git init`。此外还内置「快速打开」
栏：在 macOS 上于宿主机终端（Terminal / iTerm）中打开仓库，或启动交互式
代理 app（OpenCode / Claude / Codex / Antigravity）。

git 命令执行全部委托给 [`gmc`](https://www.npmjs.com/package/gmc)
（`gmc/lib/git.js` 的 `runGit`），本插件只做解析、组合与展示。

## 架构（一个包，双面）

```
@taontech/dsh-git (npm 包)
├── cordis.patch.yml    # bundle patch：插入 server 插件行（id: dsh-git）
├── lib/index.js        # server 插件：注册 webServer 路由 /dsh-git/*（JSON API）
├── lib/git-data.js     # 数据层：gmc 封装 + status/log/branch/init/贡献日历 解析
├── lib/launch.js       # macOS 终端 / iTerm + 代理 app 启动器（移植自 gmc web.js）
└── lib/client.js       # client bundle：注册 conversation.view 的 Git tab
                        #   （含贡献日历 + 快速打开按钮；手写 ModuleLoader 格式）
```

| 面 | 机制 | 职责 |
| --- | --- | --- |
| Server（bundle） | `dsh.bundle.patch` + `inject: ["webServer"]` | `/dsh-git/info|status|log|branches|contributions|init|open-terminal|open-agent` |
| Client | `dsh.client` 声明 + `./client` 入口 | 1. `ctx.slots.inject("conversation.view")` 注册 `id: "git"` 完整管理标签页<br>2. `ctx.slots.inject("conversation.input.dock")` 注册空白会话首页 Hero 概况卡片（分支、热力图、快捷启动、一键跳转完整管理页） |

## 安装（装进某个 profile）

本地开发（link:）：

```bash
dsh plugin --profile <name> add /path/to/this/package
```

发布后（registry）：

```bash
dsh plugin --profile <name> add @taontech/dsh-git
dsh --profile <name> --dump-config   # 确认 dsh-git 行与 bundles 生效
```

两种方式 pnpm 都会自动安装 gmc 依赖。web profile 的 client-modules 会自动
扫描 `dsh.client` 声明，把 `lib/client.js` 注入浏览器 boot graph —— 装完
**重启该 profile 的 GUI** 即可看到 Git tab。

## API（同源 JSON，浏览器直接 fetch）

| 端点 | 说明 |
| --- | --- |
| `GET /dsh-git/info?cwd=` | 仓库概况：root / branch / remote / ahead-behind / lastCommit / isDirty |
| `GET /dsh-git/status?cwd=` | 文件 + 修改标记（porcelain）；非 repo 时返回 fs 文件列表 |
| `GET /dsh-git/log?cwd=` | 提交历史（hash / 作者 / 日期 / subject） |
| `GET /dsh-git/branches?cwd=` | 分支列表 + `git log --graph` ASCII 提交图 |
| `GET /dsh-git/contributions?cwd=` | 贡献日历：最近一年每日提交次数（`date -> count`） |
| `POST /dsh-git/init` `{cwd}` | `git init`（非 repo 目录的初始化按钮） |
| `POST /dsh-git/open-terminal` `{cwd}` | 在宿主机 Terminal / iTerm 中打开仓库（仅 macOS + 回环地址） |
| `POST /dsh-git/open-agent` `{cwd, agent}` | 在终端启动交互式代理（codex / claude / antigravity / opencode，仅 macOS + 回环地址） |
| `POST /dsh-git/stage` `{cwd, paths}` | 暂存文件（路径必须来自当前 status，防止任意参数） |
| `POST /dsh-git/unstage` `{cwd, paths}` | 取消暂存（只允许已暂存文件） |
| `POST /dsh-git/commit` `{cwd, message}` | 提交已暂存内容（消息非空校验） |
| `POST /dsh-git/push` `{cwd}` | `git push` |
| `POST /dsh-git/pull` `{cwd}` | `git pull` |
| `POST /dsh-git/checkout` `{cwd, branch}` | `git switch`（分支必须存在于分支列表） |

## 验证

```bash
node test/verify-server.mjs   # 数据层单测（repo / 非 repo / init / git 操作场景，31 项）
```

## 常见问题

- **路径显示为 /private/var/...**：macOS 上 `/var` 是 `/private/var` 的符号
  链接，git 返回真实路径，属正常现象。
- **看不到 tab**：确认装进了 web profile 且重启了 GUI；`--dump-config` 里应
  有 `dsh-git` 行。
