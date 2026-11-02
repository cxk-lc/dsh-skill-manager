# dsh-skill-manager · DSH 技能管理

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）加一个左侧栏入口「技能管理」：在一页内从 **SkillHub / SkillsMP / GitHub** 搜索并安装技能，同时查看、卸载本机已安装的技能。

## 功能

- **左侧栏入口**：`sidebar.panellist` 注册的常驻条目，选中后主区域打开管理页，不影响会话。
- **已安装列表**：扫描 `~/.dsh/skills`（用户级）与 `~/.agents/skills`（全局 agents），显示名称、描述、版本、来源目录、路径、文件数、更新时间与调用范围标记。
- **卸载**：二次确认后删除目录或平铺的 `.md` 技能；只允许删除这两个根目录内的条目，拒绝越界路径。
- **SkillHub**：关键词搜索 + zip 包安装（走 `api.skillhub.cn`）。
- **SkillsMP**：关键词搜索（匿名 50 次/天，可在设置里填 API Key），按结果里的 GitHub 地址安装。
- **GitHub**：粘贴 `owner/repo`、仓库 URL 或 `/tree/分支/路径`，扫描仓库里所有 `SKILL.md` 后按需安装。
- **安装校验**：必须有 `SKILL.md`，frontmatter 的 `name`（kebab-case）与 `description` 齐全；先写暂存目录再替换，失败不留半成品。
- **同名冲突**：默认拒绝，界面弹确认后才覆盖。
- **可选凭证**：GitHub Token / SkillsMP API Key 存在本机 `~/.dsh/skill-manager/config.json`（0600），接口只回是否已配置，不回显明文。获取与配置步骤见 **[docs/credentials.md](docs/credentials.md)**。

## 安装

```bash
dsh plugin --profile desktop add link:D:\Documents\WorkBuddy\skill市场\dsh-skill-manager
```

安装后重启一次 DeepSeek Harness 桌面端，左侧栏即出现「技能管理」。

> 也可以从其他目录安装，把路径换成本仓库所在位置即可；`link:` 形式便于改完代码后刷新页面直接生效（宿主端改动需重启应用）。

## 卸载插件 / 回退

```bash
dsh plugin --profile desktop remove dsh-skill-manager
```

重启后入口消失。插件自身产生的文件只有 `~/.dsh/skill-manager/`（配置与来源记录）与经你操作安装的技能目录，可按需手动删除。

## 开发与自测

```bash
# 单元测试（零依赖，node --test）
npm test

# 在独立的 web profile 里跑，不干扰桌面端
dsh plugin --profile web add link:<本仓库>
dsh --profile web --no-open --port 3123
# 终端会打印带 token 的地址

# 无头 Chrome 冒烟：自动点开入口、抓控制台异常、截图
node tools/browse.mjs "http://127.0.0.1:3123/?token=<token>" --out shot.png \
  --eval "(async()=>{...})()"
```

## 接口

窗口内唯一入口：`POST /dsh-skill-manager/api`，body `{ method, ...params }`，必须带请求头 `x-dsh-skill-manager: 1`（跨站请求会因预检失败而无法读写）。

| method | 作用 |
|---|---|
| `status` | 目录、凭证状态、版本 |
| `installed` | 已安装技能列表 |
| `search` | `platform` = `skillhub` / `skillsmp` |
| `repoScan` | 扫描 GitHub 仓库内的技能 |
| `install` | `spec` = `{kind:'skillhub',slug}` 或 `{kind:'github',owner,repo,branch,path}` |
| `uninstall` | `rootId` + `dirName` |
| `config` | 读取/保存凭证 |

## 配置凭证

GitHub Token 与 SkillsMP API Key 都是可选的：不填也能搜索与安装，只是额度低、私有仓库不可用。

- 插件内：左侧栏「技能管理」→ **设置** → 填写 → 保存（字段旁 **说明** 点击展开，含获取路径与额度要点）。
- 配置文件：`~/.dsh/skill-manager/config.json`，字段 `githubToken` / `skillsmpKey`。

完整的获取步骤、权限取舍、额度表与故障排查见 **[docs/credentials.md](docs/credentials.md)**。

## 文档

| 文档 | 内容 |
|---|---|
| [docs/credentials.md](docs/credentials.md) | GitHub Token / SkillsMP API Key 的获取、配置、额度与排查 |
| [docs/product-design.md](docs/product-design.md) | 产品定位、MVP 范围、明确不做的事 |
| [docs/tech-design.md](docs/tech-design.md) | 技术栈、插槽与 API 契约、备选方案与风险 |
| [docs/self-test-report.md](docs/self-test-report.md) | 自测命令、结果与未覆盖项 |
| [docs/acceptance-checklist.md](docs/acceptance-checklist.md) | 人工验收清单 |

## 已知限制

- 只管理用户级两个根目录，不接管 DSH 内置技能与插件内嵌技能。
- 不做版本更新检测、批量操作、评分或私有仓库鉴权。
- GitHub 归档下载上限 50 MiB；匿名 API 60 次/小时，建议在设置里填 Token。
- 依赖 DSH 0.2.x 的 `sidebar.panellist` / `main` / `webServer` 插槽与路由契约。

## 许可

MIT
