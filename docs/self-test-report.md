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
