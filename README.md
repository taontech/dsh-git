# dsh-git —— DeepSeek Harness 的 Git tab 插件

在 DSH 的会话界面（chat / Trajectory 之后）新增一个 **Git** tab，展示当前
项目路径的 Git 信息：仓库概况、文件修改状态、提交历史、分支与提交图；
非 Git 目录则显示文件列表并支持一键 `git init`。

git 命令执行全部委托给 [`gmc`](https://www.npmjs.com/package/gmc)
（`gmc/lib/git.js` 的 `runGit`），本插件只做解析、组合与展示。

## 架构（一个包，双面）

```
dsh-git (npm 包)
├── cordis.patch.yml    # bundle patch：插入 server 插件行（id: dsh-git）
├── lib/index.js        # server 插件：注册 webServer 路由 /dsh-git/*（JSON API）
├── lib/git-data.js     # 数据层：gmc 封装 + status/log/branch/init 解析
└── lib/client.js       # client bundle：注册 conversation.view 的 Git tab
                        #   （手写 ModuleLoader 格式，无需构建链）
```

| 面 | 机制 | 职责 |
| --- | --- | --- |
| Server（bundle） | `dsh.bundle.patch` + `inject: ["webServer"]` | `/dsh-git/info|status|log|branches|init` |
| Client | `dsh.client` 声明 + `./client` 入口 | `ctx.slots.inject("conversation.view")` 注册 `id: "git"`，tab 自动出现在 chat/Trajectory 之后 |

## 安装（装进某个 profile）

```bash
dsh plugin --profile <name> add /path/to/this/package
dsh --profile <name> --dump-config   # 确认 dsh-git 行与 bundles 生效
```

web profile 的 client-modules 会自动扫描 `dsh.client` 声明，把 `lib/client.js`
注入浏览器 boot graph —— 装完**重启该 profile 的 GUI** 即可看到 Git tab。

## API（同源 JSON，浏览器直接 fetch）

| 端点 | 说明 |
| --- | --- |
| `GET /dsh-git/info?cwd=` | 仓库概况：root / branch / remote / ahead-behind / lastCommit / isDirty |
| `GET /dsh-git/status?cwd=` | 文件 + 修改标记（porcelain）；非 repo 时返回 fs 文件列表 |
| `GET /dsh-git/log?cwd=` | 提交历史（hash / 作者 / 日期 / subject） |
| `GET /dsh-git/branches?cwd=` | 分支列表 + `git log --graph` ASCII 提交图 |
| `POST /dsh-git/init` `{cwd}` | `git init`（非 repo 目录的初始化按钮） |

## 验证

```bash
node test/verify-server.mjs   # 数据层单测（repo / 非 repo / init 场景）
```

## 常见问题

- **路径显示为 /private/var/...**：macOS 上 `/var` 是 `/private/var` 的符号
  链接，git 返回真实路径，属正常现象。
- **看不到 tab**：确认装进了 web profile 且重启了 GUI；`--dump-config` 里应
  有 `dsh-git` 行。
