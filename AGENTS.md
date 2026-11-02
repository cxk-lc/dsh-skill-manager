# AGENTS.md

> 本文件是 AI 编程代理的项目值班手册。进入本项目开启新会话时，先读取本文件并遵守以下规则。
> 保持精简：高频规则放在这里，细节按需引用其他文档。

## 交付规则（必须遵守）

1. **每完成一个可验证的功能或修复后必须创建 Git commit**，保留可追踪的版本快照，便于随时回退。
2. **每次改动后必须编写或更新相关测试**，并在交付前确保所有测试与验收全部通过。
3. **所有 Git commit 信息统一使用简体中文**（初始化时确认，如需变更请同步修改本文件）。
4. **不提交密钥与敏感数据**：不要提交 `.env`、密钥、客户数据；配置示例写入 `.env.example`。

## 项目信息

- 项目名称：DSH 技能管理插件（npm 包名 `dsh-skill-manager`）
- 技术栈：ESM JavaScript，零运行时依赖、零构建；宿主端 Cordis 插件 + 浏览器端 `window.__ModuleLoader__` 单文件 React；测试用 `node --test`
- 运行命令：`dsh plugin --profile web add link:<本目录>` → `dsh --profile web --no-open --port 3123`
- 测试命令：`npm test`；UI 冒烟 `node tools/browse.mjs "<带 token 的地址>" --out shot.png`
- 目录说明：
  - `docs/`：产品设计（product-design.md）、技术方案（tech-design.md）、凭证配置说明（credentials.md）、自测报告、验收清单。凭证说明第 6 节是设置页 tooltip 的文案源，改动需同步（`test/docs-consistency.test.js` 会校验）。
  - `lib/`：宿主端（index/http/zip/frontmatter/paths/registry/install/config/sources）与客户端 `client.js`
  - `test/`：单元测试；`tools/browse.mjs`：无头 Chrome + CDP 冒烟工具

## 边界约定

- 不擅自扩大需求范围；"暂时不做"的功能清单见 `docs/product-design.md`。
- 遇到规格不明确的情况：先提问或停下，不要猜测后直接实现。
- 涉及密钥、客户数据或隐私信息时先询问，不要写入代码、日志或提交。
- 重大架构调整前，先给出方案并等待确认。
