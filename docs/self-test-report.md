# 自测报告 · DSH 技能管理插件

> 用途：阶段四交付时由实现 Agent 填写，与代码/测试一起提交，作为"AI 自测已通过"的证据。
> 原则：写命令、写结果、写未覆盖项；不要只写"测试通过"。

## 2026-11-02 · 首版（v0.1.0）

### 1. 改动范围

- 新增宿主端：`lib/index.js`（单入口 API）、`lib/http.js`、`lib/zip.js`、`lib/frontmatter.js`、`lib/paths.js`、`lib/registry.js`、`lib/install.js`、`lib/config.js`、`lib/sources/{skillhub,skillsmp,github}.js`。
- 新增客户端：`lib/client.js`（`sidebar.panellist` 入口 + `main` 面板，React.createElement，无构建）。
- 新增单测 28 项、自测工具 `tools/browse.mjs`（无头 Chrome + CDP）。
- 文档：`docs/product-design.md`、`docs/tech-design.md`、`README.md`、本报告、验收清单。

### 2. 测试命令与结果

```bash
node --test test/*.test.js
```

结果：`# tests 28 / # pass 28 / # fail 0`（耗时约 0.3s）。覆盖：

- zip：中央目录解析、非 zip、截断包、路径穿越、单层目录剥离。
- frontmatter：普通/引号/块标量/折叠标量、嵌套映射忽略、行尾注释、必填校验、布尔语法。
- paths：目录名白名单、越界拒绝、两个根的读写属性、`~` 缩写、GitHub 输入解析 6 种形态。
- install/uninstall（mock fetch + 临时 `DSH_HOME`）：SkillHub 安装、GitHub 子目录安装、EEXIST 冲突与覆盖、缺 SKILL.md、非法 frontmatter、卸载成功/不存在/越界、平铺 `.md` 技能读写。

接口级验证（`dsh --profile web` 起独立实例，端口 3123）：

| 检查 | 结果 |
|---|---|
| `status` | 返回两个根、凭证状态、版本 |
| `installed` | 17 条（`~/.agents/skills` 下 dingtalk 系列 + 用户级技能） |
| `search` skillhub `pdf` | 200，total 5002，卡片含 slug 与已安装标记 |
| `search` skillsmp `pdf` | 200，卡片含 GitHub spec（openclaw/openclaw skills/nano-pdf） |
| `repoScan` `anthropics/skills` | 200，main 分支，20 个技能目录 |
| `install` skillhub | 成功写入 `~/.dsh/skills/<name>`，8 个文件；重复安装返回 `EEXIST` |
| `install` github 子目录 | 成功，仅落地该技能目录（不含仓库其他文件） |
| `uninstall` | 目录删除、列表移除、ledger 清理 |
| 缺 `x-dsh-skill-manager` 头 | 403 `EGUARD` |
| 未知 method | 400 `ENOMETHOD` |
| 越界卸载 `../x` | 拒绝：技能名不合法 |
| 空关键词 SkillsMP | 提示"需要先输入关键词" |
| 不存在仓库 | 提示仓库可能不存在/私有/分支不同 |

### 3. 人工/辅助验证

- 启动命令：`dsh --profile web --no-open --port 3123`（打印带 token 地址）。
- 浏览器：`node tools/browse.mjs "<url>" --out shot.png --eval "<脚本>"`，无头 Chrome 1440×1000。
- 已验证：
  - 侧边栏出现「技能管理」（位于「自动化任务」下方），点击后主区域渲染管理页；**控制台 0 条异常**。
  - 已安装页签：18 条记录（含筛选后的单条）、路径与文件数、卸载按钮。
  - SkillHub 搜索 `pdf`：12 张卡片，已安装项显示「已安装」徽标。
  - GitHub 扫描 `anthropics/skills`：20 张卡片。
  - 端到端：GitHub 扫描 → 安装 `academy-guide` → 「已安装」出现 → 卸载确认框 → 删除 → 列表消失（全程控制台 0 异常）。
  - 搜索翻页：SkillHub `pdf` 12 张卡片 → 点「加载更多」→ 24 张，按钮仍可用。
  - 设置页：两个凭证字段、「未配置」标记、目录列表、版本号。
- 截图：`ui1.png`（已安装）、`ui2.png`（SkillHub 结果）、`ui3.png`（GitHub 扫描）、`ui4.png`（设置）、`ui5/ui6.png`（卸载确认与行布局）。

### 4. 已知问题与未覆盖项

- **桌面端未由 AI 完成重启验证**：本机命令行启动 Electron 应用会落入宿主沙箱，`reg.exe` 被程序黑名单拦截，启动后前端代理报 `502 upstream connect failed`（宿主进程退出）。已做对照实验：**把插件从 desktop profile 完整回滚后重启，症状完全一致**，说明该现象来自启动环境而非本插件。结论：桌面端最终确认需用户从开始菜单/快捷方式正常启动后目视。
- 语言切换（中文 ↔ English）只验证了中文渲染；英文词典未逐屏走查。
- 未实测：超过 50 MiB 的仓库归档拒绝、SkillsMP 429 限额提示（当前额度未耗尽）、私有仓库 + Token 组合。
- 桌面端与 web profile 组合不同（桌面端另有 qqbot/usage/surfcore 等插件），未观察交互影响；插件只注册 `sidebar.panellist`、`main`、`webServer`，冲突面小。

### 4.1 桌面端验证记录（供复现）

1. `dsh plugin --profile desktop add link:<本目录>` → profile `package.json` 的 `dsh.profile.bundles` 末尾出现 `dsh-skill-manager`，`node_modules` 生成符号链接。
2. 命令行重启应用 → 输出 `dsh web: http://127.0.0.1:<port>/?token=…`，随后宿主进程退出，访问端口返回 502。
3. 回滚（恢复安装前的 `package.json` / `cordis.patch.yml`）后同样 502 → 判定为环境问题。
4. 已重新安装插件，等待用户正常启动验证。

### 5. 对应提交

- `e41c1b0` docs: 补齐产品设计与技术方案（MVP 范围、插槽与 API 契约）
- `1ccf2b5` feat: 宿主端技能管理 API 与三平台技能源
- `136131f` feat: 客户端侧边栏入口与技能管理页
- `e480a6b` chore: 补充 README 与无头浏览器自测工具
- 本轮补交：自测报告与验收清单

### 6. 回退方式

```bash
dsh plugin --profile desktop remove dsh-skill-manager
```

备份：`/tmp/dsh-desktop-backup/`（安装前的 `package.json`、`cordis.patch.yml`、`pnpm-lock.yaml`）。
插件自身数据：`~/.dsh/skill-manager/`（config.json / installed.json），可整目录删除。

## 2026-11-02 · 凭证文档与设置页提示

### 1. 改动范围

- 新增 `docs/credentials.md`：GitHub Token / SkillsMP API Key 的一览、获取步骤（fine-grained / classic）、权限取舍、额度表、两种配置方式、存储安全、故障排查，第 6 节给出页面提示原文。
- `README.md` 新增「配置凭证」段与「文档」索引表，两处均链接到 `docs/credentials.md`。
- `lib/client.js` 设置页：两个凭证字段旁新增 **?** 悬浮/聚焦提示（`InfoTip`），文案与文档第 6 节逐字一致；字段下方短提示同步修正（SkillsMP 免费账号 Key 与匿名同为 50 次/日）。
- 新增 `test/docs-consistency.test.js`：断言 tooltip 文案 == 文档第 6 节引文、README 含链接、文档含关键信息。
- 顺带修复：`.dsm-field` 为纵向 flex，输入框继承 `flex:1 1 240px` 导致高度被拉到 240px；改为 `flex:0 0 auto`（实测高度 240 → 34px）。

### 2. 测试命令与结果

```bash
node --test test/*.test.js
```

结果：31 项全部通过（原 28 项 + 文档一致性 3 项）。

### 3. 人工/辅助验证

- `node tools/browse.mjs` 打开设置页：`.dsm-tip-dot` 共 2 个；聚焦第 1/2 个分别取到与文档一致的说明文本。
- 交互验证：`mouseover` 打开 = true、`mouseout` 关闭 = true、点击切换开/关各 = true。
- 视觉：提示面板位于 **?** 右侧（1440 视口下 left 466 / right 812），不遮挡左侧标签与输入框起始位置，控制台 0 异常。
- 截图：`tip3.png`（GitHub Token 提示）、`tip2.png`（修复前的高度异常对照）。

### 4. 已知问题与未覆盖项

- 提示面板在窄窗口（<820px）改为向下展开，未在真实窄窗口中逐一截图确认。
- 英文界面下的提示文案已同步翻译，但未逐屏走查英文渲染。
- 文档与提示的一致性由单测守住；若未来改动文案，需先改文档第 6 节再同步字典，否则测试会失败（这是有意设计）。

### 5. 对应提交

- 本轮提交：`docs: 新增凭证配置说明并在 README 加入口`、`feat: 设置页凭证项补充悬浮说明并加一致性测试`

## 2026-11-02 · 凭证说明改为点击展开

### 1. 改动范围

- 交互调整：设置页两个凭证项的说明由「悬浮气泡」改为「点击展开/收起」的折叠面板；收起时只占一个「▸ 说明」按钮，展开后插入在标签行与输入框之间，输入框随之下移，不覆盖任何内容。
- `lib/client.js`：移除 `InfoTip`（hover/focus 触发）与浮层定位样式，新增 `HelpTrigger` + `helpLines()`；面板按行渲染为「标签 + 内容」，标签加粗，文本仍取自同一份字典。
- 文档同步：`docs/credentials.md` §3.1 与 §6 的表述由“悬浮提示”改为“说明面板”；`README.md`、`docs/acceptance-checklist.md` 同步措辞。
- 一致性测试保持有效（`test/docs-consistency.test.js` 仍校验面板文案 == 文档 §6）。

### 2. 测试命令与结果

```bash
node --test test/*.test.js
```

结果：31 项全部通过（含 3 项文档一致性）。

### 3. 人工/辅助验证

- `node tools/browse.mjs` 打开设置页：初始 `.dsm-help-panel` 数量为 0（默认收起）。
- 点击第 1 个「说明」→ 面板出现且 `aria-expanded="true"`；再点一次 → 面板消失、`aria-expanded="false"`。
- 两个字段互不影响（分别展开/收起）。
- 面板文本与 `docs/credentials.md` §6 逐字一致（单测断言）。
- 控制台 0 异常；展开后输入框位置下移、页面无跳动遮挡。

### 4. 已知问题与未覆盖项

- 折叠状态不持久化：离开「设置」页再回来会回到收起状态（有意为之，避免页面加载即铺开长文案）。
- 窄窗口下的换行表现未逐档截图确认。

### 5. 对应提交

- 本轮提交：`refactor: 设置页凭证说明改为点击展开收起`

## 2026-11-03 · 卡片化、安装目标、GitHub 名称搜索与 Release 版本

### 1. 改动范围

- **已安装卡片**：`InstalledView` 由竖排列表改为卡片网格；`.dsm-body` 设 `container-type: inline-size`，`.dsm-grid` 在容器宽度 520 / 820 / 1080px 处切换 2 / 3 / 4 列（默认 1 列）；「全部」排序改为用户级优先（`registry.js` 按 root rank + 名称）。
- **安装目标可选**：`paths.skillRoots()` 两个根都可写；`installSkill({ targetRootId })` 支持 `user` / `agents`，冲突检测按目标根独立；页面右上角新增「安装到」分段选择器，冲突提示带上目标目录名。
- **GitHub 按名称搜索**：新增 `searchGithub()` 与 `githubSearch` 接口；`looksLikeRepoRef()` 区分仓库引用与名称；有 Token 走 `search/code` + `raw.githubusercontent.com/HEAD` 读取 SKILL.md，无 Token 通过宿主注入的 SkillsMP 索引回退，返回 `noteCode` 说明来源。
- **Release 版本**：`latestRelease()` 查询 `releases/latest`，10 分钟缓存（含 404 负缓存）；仓库扫描与名称搜索结果都补 `release` 字段；卡片显示 `Release #短哈希` 徽标，完整 tag 放 `title`。
- **Windows rename 重试**：实测安装到 `~/.agents/skills` 偶发 `EPERM`（文件监听/杀软占用），新增 `renameWithRetry`（120/240/360/480ms 退避，最多 5 次）。

### 2. 测试命令与结果

```bash
node --test test/*.test.js
```

结果：**39 项全部通过**（原 31 + 新增 8：GitHub 名称搜索 / release 缓存 / 注入索引回退 / 安装到 agents / 排序）。

### 3. 人工/辅助验证

- 列数（无头 Chrome，按视口宽度实测）：1440→4 列、980→3 列、720→2 列、560→1 列；面板侧边栏折叠时按容器宽度自适应。
- 排序：17 张卡片首个为 `stable-delivery-workflow`（用户级），其后均为全局 agents。
- 安装目标：切到「全局 agents」后经接口安装 `pdf-image-text-extractor` 成功写入 `~/.agents/skills`，二次安装返回「已存在于「全局 agents」」；界面卡片显示 `~/.agents/skills/...`，卸载确认框路径一致，删除后目录消失。
- 名称搜索：输入 `pdf` → 4.8s 返回 7 张卡（`nano-pdf`、`office-export-pdf`、`pdf` …），标题为「按名称匹配 · 7 个技能」，并显示未配置 Token 的索引说明。
- Release：`vercel-labs/agent-skills` 9 张卡片均显示 `Release #1a2c79d`（完整 tag 在 tooltip）；`anthropics/skills` 无 release 时不显示徽标。
- 控制台全程 0 异常。

### 4. 已知问题与未覆盖项

- 无 Token 时名称搜索依赖 SkillsMP 索引（覆盖度与额度受其限制），结果为空时提示配置 Token 或改用仓库地址。
- Release 查询每仓库 1 次 API（有 10 分钟缓存）；匿名 60 次/小时，批量扫描大量仓库时可能被限流，失败时静默不显示徽标。
- Release 版本仅用于展示，不做技能升级/回滚。
- 安装到 `~/.agents/skills` 会与其它 AI 工具共享目录；重名冲突按该目录独立判断。
- 窄窗口（<560px）布局未逐档截图。

### 5. 对应提交

- `feat: 支持选择安装目标并按名称搜索 GitHub 技能`
- `feat: 已安装改为响应式卡片并展示 Release 版本`
- `docs: 同步卡片、安装目标与 GitHub 名称搜索的规格`
