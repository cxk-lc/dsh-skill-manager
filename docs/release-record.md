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
