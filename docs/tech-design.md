# 技术方案文档 · DSH 技能管理插件

> 版本：v0.1 ｜ 日期：2026-11-02 ｜ 状态：已确认
> 对应产品文档：`docs/product-design.md`

## 1. 技术栈

| 层面 | 选型 | 理由 |
|---|---|---|
| 语言 | JavaScript（ESM），不使用 TypeScript | 无需构建即可被 DSH 直接加载，双端代码量可控 |
| 框架 | 宿主端 Cordis 插件（`apply/inject`）；浏览器端 React（宿主模块表注入） | DSH 官方插件模型；`require('react')` 由宿主提供，不重复打包 |
| 构建工具 | **无构建步骤** | 浏览器端手写 `window.__ModuleLoader__.load({ id, factory })` 单文件，改完即生效 |
| 依赖 | **零运行时依赖** | 只用 `node:` 内建模块 + 全局 `fetch`；不往用户 profile 装依赖，规避供应链风险 |
| 测试 | `node --test` + 自研无头 Chrome CDP 冒烟脚本 | 与零依赖一致；能抓控制台异常与截图 |

已实测确认的关键事实（DSH 0.2.1-rc.5）：

- 插件包需要 `dsh.bundle.patch`（cordis patch）+ `dsh.client`（`platform: web`）+ `exports['./client']`；`dsh plugin add` 会自动把包名写入 profile 的 `dsh.profile.bundles`。
- 浏览器 bundle 的 `id` 必须等于包名；`factory(require)` 内 `require('react')` 由宿主模块表解析。
- 侧边栏入口插槽 `sidebar.panellist`（list，root）：注册 `{ name, id, order, label }`，组件收到 `{ size, active }`。
- 主面板插槽 `main`（keyed，root）：注册 `{ name, key }`，`key` 与 `sidebar.panellist` 的 `id` 相同即被同一条目选中（已验证无需 store）。
- 宿主路由：`ctx.inject(['webServer'], c => c.webServer.register({ kind:'exact', path, handler }))`。
- 技能发现根：`<dshHome>/skills` 与 `<agentsHome>/skills`，`<name>/SKILL.md` 或平铺 `<name>.md`；frontmatter 必填 `name`(kebab-case)、`description`；目录监听自动刷新，无需重启。

## 2. 架构方向

**双端两文件 + 单入口 HTTP API**：宿主端 `lib/index.js` 承接全部文件系统与网络操作，浏览器端 `lib/client.js` 只做渲染与调用，二者通过同源 `POST /dsh-skill-manager/api` 通信，前端拿不到可写路径。

```
lib/index.js      路由分发 + 方法表 + 错误包装
lib/http.js       带超时/UA/体积上限的 fetch + 错误归一化
lib/zip.js        纯 JS zip 解包（中央目录 → inflateRaw）
lib/frontmatter.js  SKILL.md frontmatter 最小解析（含 | > 块标量）
lib/paths.js      根目录解析 + 名称校验 + 防路径穿越
lib/registry.js   已安装技能扫描（两个根）
lib/install.js    安装（暂存→校验→替换）与卸载
lib/config.js     ~/.dsh/skill-manager/config.json（0600）
lib/sources/*.js  skillhub / skillsmp / github 三个源的搜索与下载
lib/client.js     侧边栏图标 + 管理页（React.createElement）
```

**API 契约**（单入口，body `{ method, ...params }`）：

| method | 入参 | 出参 |
|---|---|---|
| `status` | — | `{ roots, config: { githubToken, skillsmpKey }, version }` |
| `installed` | — | `{ items: Skill[] }` |
| `search` | `{ platform, query, page?, limit? }` | `{ items: Card[], total, hasMore }` |
| `repoScan` | `{ input }` | `{ owner, repo, branch, skills: RepoSkill[] }` |
| `githubSearch` | `{ input, limit? }` | `{ mode: 'repo'\|'name', items, noteCode? }` |
| `install` | `{ spec, overwrite?, targetRootId? }` | `{ name, path, files, rootId }` |
| `uninstall` | `{ rootId, name }` | `{ name, path }` |
| `config` | `{ save?: { githubToken?, skillsmpKey? } }` | `{ githubToken, skillsmpKey }` |

`spec` 只有两种：`{ kind:'skillhub', slug }` 与 `{ kind:'github', owner, repo, branch, path }`。SkillsMP 的结果最终折算成 GitHub spec。

**安装落盘**：两个根都可写，`targetRootId` 决定 `~/.dsh/skills`（默认）或 `~/.agents/skills`；冲突检测按目标根独立判断。流程为「取 zip → 归一化前缀 → 校验 SKILL.md → 写暂存目录 → 冲突检查 → rm 旧目录 → rename 到位」，任一步失败清理暂存。Windows 上 rename 可能被文件监听/杀软短暂占用而抛 `EPERM/EBUSY`，`renameWithRetry` 以 120/240/360/480ms 退避重试至多 5 次。

**安全**：请求头白名单 `x-dsh-skill-manager: 1`（跨站请求会触发预检且本服务不返回 CORS 头，从浏览器侧阻断 CSRF）；body 上限 1 MiB；方法白名单；所有写入/删除经 `resolveInsideRoot()` 校验父目录严格等于受管根；卸载只接受 `rootId` 枚举，不接受任意路径。

**前端**：单页 + 顶部页签（已安装 / SkillHub / SkillsMP / GitHub / 设置），`useState` 管状态，样式用 `--dsw-alias-*` 变量带 fallback 自动适配深浅色；卸载/覆盖用内联确认条；加载、错误、空态三态显式渲染；文案走 `ctx.locale.register` + `bind`。搜索结果统一由 `CardView` 渲染：标题单行省略（`title` 保留全名）+ 版本徽标（GitHub release 优先，其次 frontmatter version）+ 描述 + 元信息 + 操作按钮，三个平台结构一致。

## 3. 备选方案与取舍记录

| 候选方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 手写 ESM/浏览器模块，零构建 | 改完即生效；零依赖；无供应链风险 | 无类型检查，需自律 | **采用** |
| tsdown + TypeScript（官方插件做法） | 类型安全、可用官方类型包 | 需装一长串 devDeps 与构建链，本地 link 安装后每次改动要重编 | 备选（后续要发 npm 再迁移） |
| 宿主端用 Typert remote 服务而非 HTTP 路由 | 类型化 RPC、鉴权由宿主负责 | 需要官方类型包与编译期 descriptor 契约，改造成本高 | 备选 |
| 单一 REST 入口（`/dsh-skill-manager/api`） | 简单、可 curl 自测、与 skillhub 插件同构 | 需自己做 CSRF 防护 | **采用** |
| GitHub 名称搜索：代码搜索 API | 结果准、只返回真实 SKILL.md | 必须认证；无 Token 不可用 | **采用（有 Token 时）** |
| GitHub 名称搜索：仓库搜索 + 扫描 | 无需认证 | 需下载归档，实测 45s 仍无结果，不能放在搜索框后面 | 否决（仅作早期方案） |
| GitHub 名称搜索：借 SkillsMP 索引 | 匿名可用、约 5s 返回、结果含 GitHub 地址 | 依赖第三方索引覆盖度，新仓库可能尚未收录 | **采用（无 Token 时第一顺位）** |
| GitHub 名称搜索：同名仓库精确匹配 | 1 次仓库搜索 + 1 个小归档，约 2s；能覆盖「技能名 = 仓库名」的新仓库 | 只覆盖同名仓库这一种命名习惯 | **采用（无 Token 时与索引并行，命中去重合并）** |
| 已安装区用容器查询控制列数 | 面板宽度变化时精确 1~4 列 | 需 Chrome 105+（Electron 37 满足） | **采用** |
| 浏览器端直连第三方 API | 少一层转发 | CORS 不通、Token 暴露在页面、无法写盘 | 否决 |
| 安装到 `~/.agents/skills` 也允许 | 覆盖更全 | 破坏其他工具的约定目录语义 | 否决（只读展示） |

## 4. 已知风险

- **DSH 升级改动插槽/加载器**：入口可能消失。对策：只用已发布稳定插槽；客户端 `apply` 全量 try 包裹，加载失败不拖垮 DSH 启动。
- **平台接口变更**（SkillHub / SkillsMP / GitHub）：搜索或下载失败。对策：源实现隔离在 `sources/`，单测用 mock fetch 固定契约，错误带平台名与状态码。
- **GitHub 匿名限流 60 次/小时**：无法扫描或安装。对策：支持可选 Token，403 时给可读提示。
- **卸载误删**：双根白名单 + 名称白名单 + 根内校验 + 界面二次确认 + 不触碰 `.` 开头的目录（含 `.system`）。
- **zip 炸弹/超大仓库**：下载上限 50 MiB，解包总量上限 200 MiB、条目上限 5000。
- **CSRF 到本地 API**：无鉴权路由可被本机页面构造请求。对策：强制自定义请求头 + 不返回 CORS 头。
- **无 Token 的名称搜索依赖 SkillsMP**：索引不可用或额度耗尽时结果为空。对策：返回 `noteCode`（`index-empty` / `index-unavailable` / `token-required`），界面给出可读说明并指向设置页。
- **Windows 目录 rename 偶发 EPERM**：实测同一请求第二次成功。对策：退避重试 + 失败清理暂存目录。

## 5. 运行与测试方式

- 安装命令：`dsh plugin --profile desktop add link:D:\Documents\WorkBuddy\skill市场\dsh-skill-manager`，随后重启 DSH 桌面端。
- 开发自测：`dsh plugin --profile web add link:<本仓库>` → `dsh --profile web --no-open --port 3123`（打印带 token 的地址）。
- 测试命令：`npm test`（`node --test test/*.test.js`）。
- 验证工具：`node tools/browse.mjs "<带 token 的地址>" --eval "<断言表达式>" --out shot.png`（无头 Chrome + CDP，抓控制台异常与截图）。
- 回退：`dsh plugin --profile desktop remove dsh-skill-manager`，重启；配置目录 `~/.dsh/skill-manager/` 可手动删除。

> 已同步更新 `AGENTS.md` 的"项目信息"一节。
