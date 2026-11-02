# 凭证配置说明 · GitHub Token 与 SkillsMP API Key

> 适用版本：dsh-skill-manager 0.1.x
> 位置：`~/.dsh/skill-manager/config.json`（0600），或插件「设置」页签
> 结论先说：两项都是**可选**的。不填也能搜索与安装，只是额度低、私有仓库不可用。

## 0. 一览

| 配置项 | 是否必需 | 影响的功能 | 不配置的后果 |
|---|---|---|---|
| GitHub Token | 可选 | GitHub 页签的仓库扫描、GitHub / SkillsMP 结果的安装（取默认分支 + 下载归档） | 匿名 60 次/小时，容易触发 403；私有仓库不可用 |
| SkillsMP API Key | 可选 | 仅 SkillsMP 页签的关键词搜索 | 匿名 50 次/天、10 次/分钟，额度用尽后返回 429 |

安装本身不消耗 SkillsMP 额度：SkillsMP 只负责“发现”，真正的文件来自 GitHub。

## 1. GitHub Token

### 1.1 它影响什么

插件用 Token 做两件事：

1. 调 `https://api.github.com/repos/{owner}/{repo}` 取仓库默认分支（也用于显示仓库信息）；
2. 下载 `https://codeload.github.com/{owner}/{repo}/zip/refs/heads/{branch}` 归档，解包后取出技能目录。

GitHub 页签的「扫描仓库」和安装动作都走这条链路；SkillHub 的安装不需要它。

### 1.2 获取步骤（Fine-grained，推荐）

1. 打开 <https://github.com/settings/personal-access-tokens/new>（需已登录且验证邮箱）。
2. **Token name** 填 `dsh-skill-manager`，**Expiration** 按习惯设 30/90 天。
3. **Repository access** 选 **Public repositories (read-only)**。
   GitHub 文档明确：fine-grained token 始终包含对所有公共仓库的只读访问。
4. 只在需要读私有仓库时，改选 **Only select repositories** 并勾选目标仓库，再在 **Permissions → Repository permissions** 里把 **Contents** 设为 **Read-only**。
5. 点 **Generate token**，复制一次性展示的令牌（`github_pat_` 开头）。

### 1.3 获取步骤（Classic，最省事）

1. 打开 <https://github.com/settings/tokens/new>。
2. **Note** 填 `dsh-skill-manager`，**Expiration** 设期限。
3. **Scopes** 一个都不勾 —— 官方说明：无 scope 的令牌只能访问公开信息，足够扫描与下载公开技能仓库。
4. 需要读私有仓库时勾 `repo`。
5. **Generate token** → 复制（`ghp_` 开头）。

> 组织启用了 SAML SSO 时，首次使用需在组织设置里对该令牌点 **Authorize**，否则表现为 403。

### 1.4 额度

| 身份 | REST API 额度 |
|---|---|
| 匿名（不带 Token） | 60 次/小时（按 IP） |
| 带 Token | 5,000 次/小时（按账号） |

一次「扫描仓库」通常只消耗 1 次 API 调用 + 1 次归档下载；归档下载走 codeload，不占 REST 额度。

### 1.5 生效与验证

- 保存后**无需重启**：每次请求都会重新读取配置。
- 验证方法：GitHub 页签输入 `anthropics/skills` → 能列出 20 个技能即生效。
- 若仍报 403 / “额度用尽”，先确认令牌没有多余空格、未过期、SSO 已授权。

## 2. SkillsMP API Key

### 2.1 它影响什么

仅影响「SkillsMP」页签的关键词搜索（`https://skillsmp.com/api/v1/skills/search`）。搜索结果里的安装动作会转成 GitHub 链接，走第 1 节的链路。

### 2.2 获取步骤

1. 打开 <https://skillsmp.com/docs/api>，点 **Generate API Key**（会跳转登录页）。
2. 登录后按页面提示生成，格式为 `sk_live_...`。
3. 复制整串密钥（含 `sk_live_` 前缀）。

### 2.3 额度

| 身份 | 搜索额度 | 频率限制 |
|---|---|---|
| 匿名 | 50 次/天（UTC） | 10 次/分钟 |
| 免费账号 Key | 50 次/UTC 日 | 30 次/分钟 |
| Standard | 5,000 次/订阅月 | 30 次/分钟 |
| Professional | 25,000 次/订阅月 | 30 次/分钟 |

注意：额度按**账号**计，轮换 Key 不会重置用量；通配符（`*`）搜索不支持，关键词必须含字母或数字。

### 2.4 生效与验证

- 保存后无需重启。
- 验证方法：SkillsMP 页签搜 `pdf` → 出卡片即生效。
- 若报 401，多为 Key 无效或复制不全；报 429 则是额度/频率用尽，界面会提示等待或更换 Key。

## 3. 两种配置方式

### 3.1 插件内（推荐）

左侧栏「技能管理」→ **设置** → 填写对应输入框 → **保存**。字段旁的标记会从「未配置」变为 **已配置**。

- 输入框留空表示“不修改已保存的值”；
- 要撤销凭证，点该字段后的 **清除** 按钮；
- 两个输入框旁的 **?** 悬浮提示给出获取路径与额度要点，与本文章节一一对应。

### 3.2 直接写配置文件

```json
{
  "githubToken": "github_pat_xxx",
  "skillsmpKey": "sk_live_xxx"
}
```

路径：`~/.dsh/skill-manager/config.json`（目录不存在时保存一次即会创建，权限 0600）。
手动修改后同样即时生效；界面上的「已配置」标记需重进页面或点「刷新」更新。

## 4. 存储与安全

- 只落本机：`~/.dsh/skill-manager/config.json`，权限 0600（仅当前用户可读写）。
- 接口只返回布尔值（是否已配置），**不回显明文**；前端输入框不会回填。
- 不写入日志、不进入 Git（项目 `.gitignore` 不涉及该路径，但配置文件在用户目录下，不在仓库内）。
- 建议给 Token 设置过期时间；怀疑泄漏时到 GitHub / SkillsMP 后台吊销并重建。
- 插件以当前 DSH 进程权限运行，能为 `~/.dsh/skills` 与 `~/.agents/skills` 写文件；Token 权限请按最小化原则授予。

## 5. 故障排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| GitHub 403 / “额度用尽” | 未配 Token、Token 过期、组织 SSO 未授权 | 重新生成并保存；到组织设置 Authorize |
| GitHub 403 但仍显示已配置 | Token 权限不含目标私有仓库 | fine-grained 加 `Contents: Read-only`，或 classic 勾 `repo` |
| SkillsMP 401 | Key 无效、复制缺字符、混入空格 | 重新复制整串 `sk_live_...`，保存时会自动 trim 首尾空白 |
| SkillsMP 429 | 当日额度或每分钟频率用尽 | 等额度重置，或换 Standard/Professional 账号的 Key |
| 保存后无变化 | 看的是旧页面状态 | 重进「技能管理」或点右上角「刷新」 |
| 配置文件写入失败 | 目录权限异常 | 确认 `~/.dsh/skill-manager` 可写，或删除该目录让插件重建 |

## 6. 页面提示原文（与本文章节对应）

设置页两个 **?** 悬浮提示的文案如下，改动时需与本文件同步：

**GitHub Token**

> 用途：调用 GitHub API 取默认分支、下载仓库归档（GitHub 页签扫描与安装都依赖它）。
> 获取：github.com/settings/personal-access-tokens/new → Repository access 选 Public repositories (read-only)；私有仓库再加 Contents: Read-only。
> 额度：匿名 60 次/小时 → 带 Token 5,000 次/小时。
> 安全：仅存本机 ~/.dsh/skill-manager/config.json（0600），不回显明文。

**SkillsMP API Key**

> 用途：仅用于 SkillsMP 页签的关键词搜索；安装走 GitHub，不消耗这里额度。
> 获取：skillsmp.com/docs/api → Generate API Key（需登录），格式 sk_live_…。
> 额度：匿名 50 次/天；免费账号 Key 同为 50 次/日；Standard 5,000/月、Professional 25,000/月；额度按账号计，换 Key 不重置。
> 安全：仅存本机，不回显明文。

---

相关文档：[README](../README.md) ｜ [产品设计](product-design.md) ｜ [技术方案](tech-design.md) ｜ [验收清单](acceptance-checklist.md)
