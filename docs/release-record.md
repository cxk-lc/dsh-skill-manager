# 发布记录 · DSH 技能管理插件

> 用途：为每个对外发布的版本留存可追溯记录（阶段五「发布子流程（可选）」的产出物）。
> 归档位置：`docs/release-record.md`（每个版本追加一节）。

## v0.1.0 · 2026-11-02

### 1. 版本号

- 版本号：v0.1.0（首个公开版本，minor：能力新增）
- 发布方式：立即发布（GitHub Release，`cxk-lc/dsh-skill-manager`）
- tag 指向 commit：`9cfbe48`（chore: 添加 MIT 许可证并补充 GitHub 安装方式）
- 是否已推送远端：是（`origin/main` + `origin v0.1.0`）
- Release 地址：https://github.com/cxk-lc/dsh-skill-manager/releases/tag/v0.1.0
- 仓库地址：https://github.com/cxk-lc/dsh-skill-manager（public）

### 2. 变更摘要

- 新增左侧栏入口「技能管理」与主面板（`sidebar.panellist` + `main`）。
- 已安装列表：扫描 `~/.dsh/skills` 与 `~/.agents/skills`，支持筛选与只读展示。
- 卸载：二次确认，限两个受管根目录，越界路径拒绝。
- 三个来源：SkillHub（搜索 + zip 安装）、SkillsMP（搜索，按结果 GitHub 地址安装）、GitHub（仓库扫描 + 子目录安装）。
- 安装校验与原子落盘、同名冲突确认、可选凭证（GitHub Token / SkillsMP API Key，0600 本地存储）。
- 设置页凭证说明为点击展开面板，文案与 `docs/credentials.md` 第 6 节逐字一致（单测校验）。
- 许可证：MIT。

### 3. 验证证据

- 测试：`node --test test/*.test.js` → 31 项全部通过（zip / frontmatter / paths / GitHub 解析 / 安装卸载 / 文档一致性）。
- 接口实测：三平台搜索、`anthropics/skills` 扫描（20 个技能）、SkillHub 安装与重复安装 `EEXIST`、卸载清理、越界拒绝、缺头 403。
- UI 冒烟：无头 Chrome + CDP，侧边栏入口 → 安装 → 已安装 → 卸载确认 → 删除，控制台 0 异常；设置页折叠面板开合验证通过。
- 人工验收：`docs/acceptance-checklist.md` 已交付，桌面端逐项走查由用户执行（AI 侧受启动环境限制未完成桌面端重启验证，见 `docs/self-test-report.md`）。

### 4. 已知问题

- 桌面端最终目视验收仍待用户从快捷方式启动后确认。
- 英文界面文案未逐屏走查；窄窗口（<820px）布局未逐档截图。
- 未实测：>50 MiB 仓库归档拒绝、SkillsMP 429 限额提示、私有仓库 + Token 组合。

### 5. 回滚指令

```bash
# 本地回退到上一个稳定状态（本版为首个版本，回退即退回初始化提交）
git checkout 56af0aa

# 或撤销插件安装
dsh plugin --profile desktop remove dsh-skill-manager
```

## v0.2.1 · 2026-11-03

### 1. 版本号

- 版本号：v0.2.1（minor：能力新增 + 修复；v0.2.0 仅存在于开发过程，未单独发布）
- 发布方式：立即发布（GitHub Release，`cxk-lc/dsh-skill-manager`）
- tag 指向 commit：`44a79f2`（docs: 同步名称搜索回退链与统一卡片的说明）
- 是否已推送远端：是（`origin/main` + `origin v0.2.1`）
- Release 地址：https://github.com/cxk-lc/dsh-skill-manager/releases/tag/v0.2.1

### 2. 变更摘要

- 已安装区改为卡片网格（1~4 列，用户级优先）。
- 安装目标可选：用户级 / 全局 agents，冲突按目标目录独立判断。
- GitHub 按名称搜索：有 Token 走代码搜索；无 Token 并行 SkillsMP 索引 + 仓库名精确匹配。
- GitHub 卡片展示仓库最新 Release 版本徽标。
- 三平台卡片结构统一，标题单行省略。
- 修复 Windows 安装目录 rename 偶发 EPERM（退避重试）。
- 卡片边框改用 `border-l3` + 阴影；宿主/前端版本不一致时页面提示重启。

### 3. 验证证据

- 测试：`node --test test/*.test.js` → 40 项全部通过（zip / frontmatter / paths / GitHub 解析 / 安装卸载 / 名称搜索 / Release 缓存 / 文档一致性）。
- 接口实测：`githubSearch("stable-delivery-workflow")` 2.05s 返回同名仓库技能；`vercel-labs/agent-skills` 9 张卡片带 Release 徽标；`pdf` 返回 7 条索引结果。
- UI 冒烟：无头 Chrome 验证 1440/980/720/560 下 4/3/2/1 列、安装到全局 agents 的写入与卸载、名称搜索与提示文案，控制台 0 异常。
- 人工验收：用户在本轮以「发布」指令确认；此前已在桌面端完成走查并反馈三轮问题，均已修复。
- 说明：桌面端当前运行的宿主为 0.2.0，本次 0.2.1 的宿主侧改动（同名仓库匹配）需重启应用后生效；界面改动刷新即可。

### 4. 已知问题

- 无 Token 时名称搜索覆盖有限（索引收录或同名仓库）。
- Release 版本仅展示，不做升级/回滚。
- 桌面端 0.2.1 宿主尚未由用户重启验证。

### 5. 回滚指令

```bash
git checkout v0.1.0
# 或撤销插件安装
dsh plugin --profile desktop remove dsh-skill-manager
```
