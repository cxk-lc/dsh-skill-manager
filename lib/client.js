/**
 * dsh-skill-manager — browser half.
 *
 * Registers the left-sidebar entry and renders the whole management page as one
 * React tree. Everything it knows about the filesystem comes from the host API;
 * the page itself never handles a path it can write to.
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-manager',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useRef, useState } = React

    const NS = 'skill-manager'
    const PANEL_ID = 'skill-manager'
    const API = 'dsh-skill-manager/api'

    const zh = {
      title: '技能管理',
      subtitle: '本机 {n} 个技能',
      tabInstalled: '已安装',
      tabSkillhub: 'SkillHub',
      tabSkillsmp: 'SkillsMP',
      tabGithub: 'GitHub',
      tabSettings: '设置',
      refresh: '刷新',
      search: '搜索',
      searchPlaceholder: '搜索技能，例如 pdf / 周报 / 代码审查',
      searchHintSkillhub: '在 SkillHub 搜索并安装技能；留空则浏览热门。',
      searchHintSkillsmp: 'SkillsMP 需要关键词；匿名每天 50 次，可在「设置」里填 Key。',
      emptyInstalled: '还没有安装任何技能。到 SkillHub / SkillsMP / GitHub 页签装一个试试。',
      emptySearch: '没有找到相关技能，换个关键词试试。',
      emptyRepo: '这个仓库里没有可安装的技能。',
      install: '安装',
      installing: '安装中…',
      installedBadge: '已安装',
      reinstall: '重新安装',
      uninstall: '卸载',
      loadMore: '加载更多',
      loading: '加载中…',
      all: '全部',
      userRoot: '用户级',
      agentsRoot: '全局 agents',
      files: '{n} 个文件',
      filterPlaceholder: '筛选已安装技能',
      confirmDeleteTitle: '确认卸载「{name}」？',
      confirmDeleteBody: '将删除目录 {path}，删除后不可恢复。',
      confirmOverwriteTitle: '「{name}」已存在',
      confirmOverwriteBody: '覆盖安装会用新版本替换现有技能目录。',
      cancel: '取消',
      deleteAction: '删除',
      overwriteAction: '覆盖安装',
      installedToast: '已安装 {name}',
      uninstalledToast: '已卸载 {name}',
      savedToast: '设置已保存',
      repoPlaceholder: 'owner/repo、仓库链接或 /tree/分支/路径',
      scan: '扫描仓库',
      scanning: '扫描中…',
      repoResult: '{repo} · 分支 {branch} · {n} 个技能',
      repoHint: '支持 anthropics/skills、https://github.com/owner/repo/tree/main/skills/xxx。',
      settingsTitle: '凭证与目录',
      githubToken: 'GitHub Token',
      githubTokenHint: '可选。填写后 GitHub API 限额从 60 次/小时提升到 5,000 次/小时，私有仓库也可访问。',
      skillsmpKey: 'SkillsMP API Key',
      skillsmpKeyHint: '可选。匿名 50 次/天；免费账号 Key 同为 50 次/日，Standard / Professional 提升到 5,000 / 25,000 次每月。',
      helpShow: '说明',
      tipGithub:
        '用途：调用 GitHub API 取默认分支、下载仓库归档（GitHub 页签扫描与安装都依赖它）。\n获取：github.com/settings/personal-access-tokens/new → Repository access 选 Public repositories (read-only)；私有仓库再加 Contents: Read-only。\n额度：匿名 60 次/小时 → 带 Token 5,000 次/小时。\n安全：仅存本机 ~/.dsh/skill-manager/config.json（0600），不回显明文。',
      tipSkillsmp:
        '用途：仅用于 SkillsMP 页签的关键词搜索；安装走 GitHub，不消耗这里额度。\n获取：skillsmp.com/docs/api → Generate API Key（需登录），格式 sk_live_…。\n额度：匿名 50 次/天；免费账号 Key 同为 50 次/日；Standard 5,000/月、Professional 25,000/月；额度按账号计，换 Key 不重置。\n安全：仅存本机，不回显明文。',
      configured: '已配置',
      notConfigured: '未配置',
      keepEmpty: '已配置，留空表示不修改',
      save: '保存',
      clear: '清除',
      rootsTitle: '技能目录',
      rootsHint: '安装统一写入用户级目录；全局 agents 目录只展示与卸载，不会被写入。',
      version: '插件版本 {v}',
      modelOff: '仅手动调用',
      userOff: '仅模型可见',
      fillFirst: '请先填写内容',
      noQuery: '请先输入关键词',
      loadingFailed: '加载失败',
      sourceUnknown: '本地',
      dangerNote: '卸载会直接删除磁盘目录，请确认后再操作。',
    }

    const en = {
      title: 'Skills',
      subtitle: '{n} installed',
      tabInstalled: 'Installed',
      tabSkillhub: 'SkillHub',
      tabSkillsmp: 'SkillsMP',
      tabGithub: 'GitHub',
      tabSettings: 'Settings',
      refresh: 'Refresh',
      search: 'Search',
      searchPlaceholder: 'Search skills, e.g. pdf / report / code review',
      searchHintSkillhub: 'Search and install from SkillHub; leave empty to browse popular skills.',
      searchHintSkillsmp: 'SkillsMP needs a keyword; anonymous limit is 50/day, add a key in Settings.',
      emptyInstalled: 'Nothing installed yet. Try the SkillHub, SkillsMP or GitHub tab.',
      emptySearch: 'No skills matched. Try another keyword.',
      emptyRepo: 'No installable skill found in this repository.',
      install: 'Install',
      installing: 'Installing…',
      installedBadge: 'Installed',
      reinstall: 'Reinstall',
      uninstall: 'Uninstall',
      loadMore: 'Load more',
      loading: 'Loading…',
      all: 'All',
      userRoot: 'User',
      agentsRoot: 'Global agents',
      files: '{n} files',
      filterPlaceholder: 'Filter installed skills',
      confirmDeleteTitle: 'Uninstall “{name}”?',
      confirmDeleteBody: 'This deletes {path} and cannot be undone.',
      confirmOverwriteTitle: '“{name}” already exists',
      confirmOverwriteBody: 'Overwriting replaces the existing skill directory.',
      cancel: 'Cancel',
      deleteAction: 'Delete',
      overwriteAction: 'Overwrite',
      installedToast: 'Installed {name}',
      uninstalledToast: 'Uninstalled {name}',
      savedToast: 'Settings saved',
      repoPlaceholder: 'owner/repo, repository URL, or /tree/branch/path',
      scan: 'Scan repository',
      scanning: 'Scanning…',
      repoResult: '{repo} · branch {branch} · {n} skills',
      repoHint: 'Accepts anthropics/skills or https://github.com/owner/repo/tree/main/skills/xxx.',
      settingsTitle: 'Credentials and folders',
      githubToken: 'GitHub token',
      githubTokenHint: 'Optional. Raises the GitHub API limit from 60/h to 5,000/h and allows private repositories.',
      skillsmpKey: 'SkillsMP API key',
      skillsmpKeyHint: 'Optional. Anonymous: 50/day. A free account key is also 50/day; Standard / Professional raise it to 5,000 / 25,000 per month.',
      helpShow: 'How to get it',
      tipGithub:
        'Used for: calling the GitHub API for the default branch and downloading repository archives (both the GitHub tab scan and install rely on it).\nGet one: github.com/settings/personal-access-tokens/new → Repository access: Public repositories (read-only); for private repos add Contents: Read-only.\nLimit: 60/h anonymous → 5,000/h with a token.\nStorage: local only at ~/.dsh/skill-manager/config.json (0600); never echoed back.',
      tipSkillsmp:
        'Used for: keyword search on the SkillsMP tab only; installing goes through GitHub and does not consume this quota.\nGet one: skillsmp.com/docs/api → Generate API Key (sign-in required), format sk_live_….\nLimit: 50/day anonymous; a free account key is also 50/day; Standard 5,000/month, Professional 25,000/month; quota is per account, rotating a key does not reset it.\nStorage: local only; never echoed back.',
      configured: 'Configured',
      notConfigured: 'Not configured',
      keepEmpty: 'Configured — leave empty to keep',
      save: 'Save',
      clear: 'Clear',
      rootsTitle: 'Skill folders',
      rootsHint: 'Installs always go to the user folder; the global agents folder is read-only from here.',
      version: 'Plugin version {v}',
      modelOff: 'Manual only',
      userOff: 'Model only',
      fillFirst: 'Fill in the field first',
      noQuery: 'Enter a keyword first',
      loadingFailed: 'Failed to load',
      sourceUnknown: 'Local',
      dangerNote: 'Uninstall deletes the directory on disk. Confirm before continuing.',
    }

    const dictionaries = { zh, en }
    const fallbackLang =
      typeof navigator !== 'undefined' && String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
    const fallbackT = (key, vars) => interpolate(dictionaries[fallbackLang][key] || key, vars)

    function interpolate(template, vars) {
      if (!vars) return template
      return String(template).replace(/\{(\w+)\}/g, (all, name) => (vars[name] === undefined ? all : String(vars[name])))
    }

    const CSS = `
.dsm-page{position:relative;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;
  color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.55;padding-top:var(--dsh-frame-top-clearance,0px)}
.dsm-head{flex:0 0 auto;padding:18px 28px 0}
.dsm-headrow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dsm-title{display:flex;align-items:baseline;gap:10px;font-size:16px;font-weight:600}
.dsm-sub{font-size:12px;font-weight:400;color:var(--dsw-alias-label-caption,#6b7280)}
.dsm-tabs{display:flex;gap:2px;margin-top:12px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);flex-wrap:wrap}
.dsm-tab{appearance:none;background:none;border:0;border-bottom:2px solid transparent;padding:7px 10px;margin-bottom:-1px;
  font:inherit;font-size:13px;color:var(--dsw-alias-label-secondary,#4b5563);cursor:pointer;border-radius:6px 6px 0 0}
.dsm-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}
.dsm-tab[data-active="true"]{color:var(--dsw-alias-label-primary,inherit);border-bottom-color:var(--dsw-alias-label-primary,#111);font-weight:600}
.dsm-body{flex:1 1 auto;min-height:0;overflow:auto;padding:14px 28px 48px}
.dsm-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsm-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,transparent);
  color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:12px;padding:5px 11px;border-radius:8px;cursor:pointer;
  transition:background .12s ease,border-color .12s ease;white-space:nowrap}
.dsm-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.05))}
.dsm-btn:disabled{opacity:.55;cursor:default}
.dsm-btn[data-kind="primary"]{background:var(--dsw-alias-button-primary-fill,#111);border-color:transparent;
  color:var(--dsw-alias-label-primary-inverted,#fff)}
.dsm-btn[data-kind="primary"]:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#333)}
.dsm-btn[data-kind="danger"]{color:var(--dsw-alias-state-error-primary,#dc2626);border-color:var(--dsw-alias-border-l2,#e5e7eb)}
.dsm-btn[data-kind="danger"]:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,rgba(220,38,38,.08))}
.dsm-input{flex:1 1 240px;min-width:160px;background:var(--dsw-alias-bg-layer-1,transparent);
  border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;
  color:var(--dsw-alias-label-primary,inherit);outline:none}
.dsm-input:focus{border-color:var(--dsw-alias-brand-primary,#2563eb)}
.dsm-hint{color:var(--dsw-alias-label-caption,#6b7280);font-size:12px;margin:8px 0 0}
.dsm-searchbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:10px;margin-top:14px}
.dsm-card{display:flex;flex-direction:column;gap:6px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);
  border-radius:10px;padding:12px;background:var(--dsw-alias-bg-layer-3,transparent)}
.dsm-card-head{display:flex;gap:8px;align-items:flex-start;justify-content:space-between}
.dsm-name{font-weight:600;font-size:13px;word-break:break-word}
.dsm-desc{color:var(--dsw-alias-label-secondary,#4b5563);font-size:12px;display:-webkit-box;-webkit-line-clamp:3;
  -webkit-box-orient:vertical;overflow:hidden;min-height:52px}
.dsm-meta{display:flex;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-caption,#6b7280);font-size:11px}
.dsm-card-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:auto;padding-top:4px}
.dsm-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:1px 7px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2,#e5e7eb);color:var(--dsw-alias-label-secondary,#4b5563)}
.dsm-chip[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#059669);border-color:currentColor}
.dsm-chip[data-tone="warn"]{color:var(--dsw-alias-state-warn-primary,#b45309);border-color:currentColor}
.dsm-chip[data-tone="muted"]{color:var(--dsw-alias-label-caption,#6b7280)}
.dsm-list{display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:10px;
  overflow:hidden;margin-top:12px;background:var(--dsw-alias-bg-layer-3,transparent)}
.dsm-item{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:11px 14px;
  border-top:1px solid var(--dsw-alias-border-l1,#f1f5f9)}
.dsm-item:first-child{border-top:0}
.dsm-item-main{min-width:0;display:flex;flex-direction:column;gap:3px}
.dsm-path{font-family:var(--dsw-font-family-mono,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:11px;
  color:var(--dsw-alias-label-caption,#6b7280);word-break:break-all}
.dsm-empty{padding:36px 16px;text-align:center;color:var(--dsw-alias-label-caption,#6b7280);font-size:13px}
.dsm-empty-box{border:1px dashed var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;margin-top:16px}
.dsm-alert{display:flex;gap:8px;align-items:flex-start;margin-top:12px;padding:9px 12px;border-radius:8px;font-size:12px;
  border:1px solid currentColor;color:var(--dsw-alias-state-error-primary,#dc2626);background:transparent}
.dsm-toast{position:absolute;left:50%;transform:translateX(-50%);bottom:18px;z-index:20;padding:8px 14px;border-radius:999px;
  font-size:12px;background:var(--dsw-alias-tooltip-bg,#111);color:var(--dsw-alias-label-primary-inverted,#fff);
  box-shadow:0 6px 20px rgba(0,0,0,.18)}
.dsm-overlay{position:absolute;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.32);backdrop-filter:blur(1px)}
.dsm-dialog{width:min(420px,calc(100% - 48px));background:var(--dsw-alias-bg-layer-1,#fff);border-radius:14px;padding:18px;
  border:1px solid var(--dsw-alias-border-l2,#e5e7eb);box-shadow:0 18px 48px rgba(0,0,0,.22)}
.dsm-dialog h4{margin:0 0 8px;font-size:14px}
.dsm-dialog p{margin:0 0 14px;font-size:12px;color:var(--dsw-alias-label-secondary,#4b5563);word-break:break-word}
.dsm-dialog-actions{display:flex;justify-content:flex-end;gap:8px}
.dsm-section{margin-top:22px}
.dsm-section h3{font-size:13px;margin:0 0 4px}
.dsm-field{display:flex;flex-direction:column;gap:4px;margin-top:14px;max-width:520px}
.dsm-field label{font-size:12px;font-weight:600}
.dsm-field .dsm-hint{margin:0}
.dsm-field .dsm-input{flex:0 0 auto;width:100%;box-sizing:border-box}
.dsm-field-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.dsm-help-trigger{display:inline-flex;align-items:center;gap:3px;border:0;background:none;padding:0;font:inherit;
  font-size:12px;color:var(--dsw-alias-label-caption,#6b7280);cursor:pointer}
.dsm-help-trigger:hover{color:var(--dsw-alias-label-primary,inherit);text-decoration:underline}
.dsm-help-caret{display:inline-block;font-size:10px;transition:transform .12s ease}
.dsm-help-trigger[aria-expanded="true"] .dsm-help-caret{transform:rotate(90deg)}
.dsm-help-panel{margin-top:6px;padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);
  background:var(--dsw-alias-bg-layer-2,#f7f7f8);color:var(--dsw-alias-label-secondary,#4b5563);font-size:12px;
  line-height:1.65;display:flex;flex-direction:column;gap:5px;max-width:520px;box-sizing:border-box}
.dsm-help-line b{color:var(--dsw-alias-label-primary,inherit);font-weight:600;margin-right:5px}
.dsm-kv{display:grid;grid-template-columns:120px 1fr;gap:6px 12px;font-size:12px;margin-top:10px}
.dsm-kv div:nth-child(odd){color:var(--dsw-alias-label-caption,#6b7280)}
.dsm-skel{color:var(--dsw-alias-label-caption,#6b7280);padding:24px 0;font-size:12px}
@media (max-width:720px){.dsm-head{padding:14px 16px 0}.dsm-body{padding:12px 16px 32px}}
`

    function ensureCss() {
      if (typeof document === 'undefined') return () => {}
      const id = 'dsm-style'
      let node = document.getElementById(id)
      if (!node) {
        node = document.createElement('style')
        node.id = id
        node.textContent = CSS
        document.head.appendChild(node)
      }
      return () => {}
    }

    async function call(method, params) {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-dsh-skill-manager': '1' },
        body: JSON.stringify({ method, ...(params || {}) }),
      })
      let payload
      try {
        payload = await res.json()
      } catch {
        throw new Error(`接口返回异常（HTTP ${res.status}）`)
      }
      if (!payload.ok) {
        const err = new Error(payload.error || '请求失败')
        err.code = payload.code
        throw err
      }
      return payload
    }

    function formatCount(value) {
      const n = Number(value) || 0
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'm'
      if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
      return String(n)
    }

    function Icon({ size }) {
      const s = size || 18
      return h(
        'svg',
        { width: s, height: s, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M8 1.8 13.2 4.4 8 7 2.8 4.4 8 1.8Z',
          stroke: 'currentColor',
          strokeWidth: '1.2',
          strokeLinejoin: 'round',
        }),
        h('path', { d: 'M2.8 7.6 8 10.2l5.2-2.6', stroke: 'currentColor', strokeWidth: '1.2', strokeLinejoin: 'round' }),
        h('path', { d: 'M2.8 10.8 8 13.4l5.2-2.6', stroke: 'currentColor', strokeWidth: '1.2', strokeLinejoin: 'round' }),
      )
    }

    function Chip({ tone, children }) {
      return h('span', { className: 'dsm-chip', 'data-tone': tone || 'muted' }, children)
    }

    /**
     * Render the help text as one labelled row per line. The text itself comes
     * from `docs/credentials.md` §6, so the page and the document stay in sync.
     * @param {string} text
     */
    function helpLines(text) {
      return String(text || '')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line, index) => {
          const match = /^([^：:/]{1,10})([：:])\s*([\s\S]*)$/.exec(line)
          return match
            ? h('div', { className: 'dsm-help-line', key: index }, h('b', null, match[1] + match[2]), match[3])
            : h('div', { className: 'dsm-help-line', key: index }, line)
        })
    }

    /**
     * Collapsed-by-default help trigger: one click expands the panel, a second
     * click folds it back.
     * @param {{open: boolean, label: string, controls: string, onToggle: () => void}} props
     */
    function HelpTrigger({ open, label, controls, onToggle }) {
      return h(
        'button',
        {
          type: 'button',
          className: 'dsm-help-trigger',
          'aria-expanded': open ? 'true' : 'false',
          'aria-controls': controls,
          onClick: onToggle,
        },
        h('span', { className: 'dsm-help-caret', 'aria-hidden': 'true' }, '▸'),
        h('span', null, label),
      )
    }

    function Alert({ text }) {
      if (!text) return null
      return h('div', { className: 'dsm-alert' }, h('span', null, '⚠'), h('span', null, text))
    }

    function Empty({ text }) {
      return h('div', { className: 'dsm-empty dsm-empty-box' }, text)
    }

    function Dialog({ title, body, confirmLabel, cancelLabel, onCancel, onConfirm, busy, danger }) {
      return h(
        'div',
        { className: 'dsm-overlay', role: 'dialog', 'aria-modal': 'true' },
        h(
          'div',
          { className: 'dsm-dialog', onClick: (event) => event.stopPropagation() },
          h('h4', null, title),
          h('p', null, body),
          h(
            'div',
            { className: 'dsm-dialog-actions' },
            h('button', { type: 'button', className: 'dsm-btn', onClick: onCancel, disabled: busy }, cancelLabel || 'Cancel'),
            h(
              'button',
              {
                type: 'button',
                className: 'dsm-btn',
                'data-kind': danger ? 'danger' : 'primary',
                onClick: onConfirm,
                disabled: busy,
              },
              confirmLabel,
            ),
          ),
        ),
      )
    }

    function InstalledView(props) {
      const { t, items, roots, loading, filter, setFilter, rootFilter, setRootFilter, onUninstall } = props
      if (loading && !items) return h('div', { className: 'dsm-skel' }, t('loading'))
      const list = (items || []).filter((item) => {
        if (rootFilter !== 'all' && item.rootId !== rootFilter) return false
        if (!filter) return true
        const needle = filter.toLowerCase()
        return (
          item.name.toLowerCase().includes(needle) ||
          String(item.description || '').toLowerCase().includes(needle)
        )
      })
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dsm-row' },
          h('input', {
            className: 'dsm-input',
            placeholder: t('filterPlaceholder'),
            value: filter,
            onChange: (event) => setFilter(event.target.value),
          }),
          h(
            'div',
            { className: 'dsm-row', style: { flex: '0 0 auto', gap: '4px' } },
            ['all', ...roots.map((root) => root.id)].map((id) =>
              h(
                'button',
                {
                  key: id,
                  type: 'button',
                  className: 'dsm-btn',
                  'data-kind': rootFilter === id ? 'primary' : undefined,
                  onClick: () => setRootFilter(id),
                },
                id === 'all' ? t('all') : roots.find((root) => root.id === id)?.label || id,
              ),
            ),
          ),
        ),
        !list.length
          ? h(Empty, { text: items && items.length ? t('emptySearch') : t('emptyInstalled') })
          : h(
              'div',
              { className: 'dsm-list' },
              list.map((item) =>
                h(
                  'div',
                  { className: 'dsm-item', key: item.rootId + '/' + item.dirName },
                  h(
                    'div',
                    { className: 'dsm-item-main' },
                    h(
                      'div',
                      { className: 'dsm-row', style: { gap: '6px' } },
                      h('span', { className: 'dsm-name' }, item.name),
                      item.version ? h(Chip, { tone: 'muted' }, 'v' + item.version) : null,
                      h(Chip, { tone: 'muted' }, item.rootLabel),
                      item.source ? h(Chip, { tone: 'ok' }, item.source) : null,
                      item.modelInvocable === false ? h(Chip, { tone: 'warn' }, t('modelOff')) : null,
                      item.userInvocable === false ? h(Chip, { tone: 'warn' }, t('userOff')) : null,
                    ),
                    item.description ? h('div', { className: 'dsm-desc' }, item.description) : null,
                    h('div', { className: 'dsm-path' }, item.path),
                    h(
                      'div',
                      { className: 'dsm-meta' },
                      h('span', null, t('files', { n: item.files })),
                      item.updatedAt ? h('span', null, item.updatedAt.slice(0, 10)) : null,
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'dsm-btn',
                      'data-kind': 'danger',
                      onClick: () => onUninstall(item),
                    },
                    t('uninstall'),
                  ),
                ),
              ),
            ),
      )
    }

    function CardView({ t, card, busy, onInstall }) {
      const meta = []
      if (card.author) meta.push(card.author)
      if (card.platform === 'skillsmp' && card.stars) meta.push('★ ' + formatCount(card.stars))
      if (card.downloads) meta.push('↓ ' + formatCount(card.downloads))
      if (card.version) meta.push('v' + card.version)
      if (card.files) meta.push(t('files', { n: card.files }))
      if (card.language) meta.push(card.language)
      return h(
        'div',
        { className: 'dsm-card' },
        h(
          'div',
          { className: 'dsm-card-head' },
          h('div', { className: 'dsm-name' }, card.name),
          card.installed ? h(Chip, { tone: 'ok' }, t('installedBadge')) : null,
        ),
        h('div', { className: 'dsm-desc' }, card.description || ''),
        meta.length ? h('div', { className: 'dsm-meta' }, meta.map((text, index) => h('span', { key: index }, text))) : null,
        h(
          'div',
          { className: 'dsm-card-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsm-btn',
              'data-kind': card.installed ? undefined : 'primary',
              disabled: Boolean(busy),
              onClick: () => onInstall(card),
            },
            busy ? t('installing') : card.installed ? t('reinstall') : t('install'),
          ),
        ),
      )
    }

    function SearchView(props) {
      const { t, platform, state, onQueryChange, onSearch, onInstall, onMore, busyId, hint } = props
      const canMore = state.items && state.items.length < (state.total || 0)
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dsm-searchbar' },
          h('input', {
            className: 'dsm-input',
            placeholder: t('searchPlaceholder'),
            value: state.query,
            onChange: (event) => onQueryChange(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onSearch()
            },
          }),
          h(
            'button',
            { type: 'button', className: 'dsm-btn', 'data-kind': 'primary', onClick: onSearch, disabled: state.loading },
            state.loading ? t('loading') : t('search'),
          ),
        ),
        h('p', { className: 'dsm-hint' }, hint),
        h(Alert, { text: state.error }),
        !state.items
          ? state.loading
            ? h('div', { className: 'dsm-skel' }, t('loading'))
            : null
          : !state.items.length
            ? h(Empty, { text: t('emptySearch') })
            : h(
                'div',
                { className: 'dsm-grid' },
                state.items.map((card) =>
                  h(CardView, {
                    key: platform + ':' + card.id,
                    t,
                    card,
                    busy: busyId === platform + ':' + card.id,
                    onInstall,
                  }),
                ),
              ),
        canMore
          ? h(
              'div',
              { style: { display: 'flex', justifyContent: 'center', marginTop: '14px' } },
              h(
                'button',
                { type: 'button', className: 'dsm-btn', onClick: onMore, disabled: state.loading },
                state.loading ? t('loading') : t('loadMore'),
              ),
            )
          : null,
      )
    }

    function RepoView({ t, state, setInput, onScan, onInstall, busyId }) {
      return h(
        'div',
        null,
        h(
          'div',
          { className: 'dsm-searchbar' },
          h('input', {
            className: 'dsm-input',
            placeholder: t('repoPlaceholder'),
            value: state.input,
            onChange: (event) => setInput(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') onScan()
            },
          }),
          h(
            'button',
            { type: 'button', className: 'dsm-btn', 'data-kind': 'primary', onClick: onScan, disabled: state.loading },
            state.loading ? t('scanning') : t('scan'),
          ),
        ),
        h('p', { className: 'dsm-hint' }, t('repoHint')),
        h(Alert, { text: state.error }),
        state.loading ? h('div', { className: 'dsm-skel' }, t('loading')) : null,
        state.items
          ? !state.items.length
            ? h(Empty, { text: t('emptyRepo') })
            : h(
                'div',
                null,
                h(
                  'p',
                  { className: 'dsm-hint' },
                  t('repoResult', { repo: state.owner + '/' + state.repo, branch: state.branch, n: state.items.length }),
                ),
                h(
                  'div',
                  { className: 'dsm-grid' },
                  state.items.map((card) =>
                    h(CardView, {
                      key: card.id,
                      t,
                      card,
                      busy: busyId === 'github:' + card.id,
                      onInstall,
                    }),
                  ),
                ),
              )
          : null,
      )
    }

    function SettingsView({ t, status, settings, setSettings, onSave, onClear, saving }) {
      const configuredGithub = Boolean(status?.config?.githubToken)
      const configuredMp = Boolean(status?.config?.skillsmpKey)
      const [openHelp, setOpenHelp] = useState({ github: false, skillsmp: false })
      const toggleHelp = (key) => setOpenHelp((prev) => ({ ...prev, [key]: !prev[key] }))
      return h(
        'div',
        null,
        h('div', { className: 'dsm-section' }, h('h3', null, t('settingsTitle'))),
        h(
          'div',
          { className: 'dsm-field' },
          h(
            'div',
            { className: 'dsm-field-head' },
            h('label', { htmlFor: 'dsm-gh' }, t('githubToken')),
            h(Chip, { tone: configuredGithub ? 'ok' : 'muted' }, configuredGithub ? t('configured') : t('notConfigured')),
            h(HelpTrigger, {
              open: openHelp.github,
              label: t('helpShow'),
              controls: 'dsm-help-github',
              onToggle: () => toggleHelp('github'),
            }),
          ),
          openHelp.github
            ? h(
                'div',
                { className: 'dsm-help-panel', id: 'dsm-help-github', role: 'region' },
                helpLines(t('tipGithub')),
              )
            : null,
          h('input', {
            id: 'dsm-gh',
            className: 'dsm-input',
            type: 'password',
            autoComplete: 'off',
            placeholder: configuredGithub ? t('keepEmpty') : 'ghp_…',
            value: settings.githubToken,
            onChange: (event) => setSettings((prev) => ({ ...prev, githubToken: event.target.value })),
          }),
          h('p', { className: 'dsm-hint' }, t('githubTokenHint')),
        ),
        h(
          'div',
          { className: 'dsm-field' },
          h(
            'div',
            { className: 'dsm-field-head' },
            h('label', { htmlFor: 'dsm-mp' }, t('skillsmpKey')),
            h(Chip, { tone: configuredMp ? 'ok' : 'muted' }, configuredMp ? t('configured') : t('notConfigured')),
            h(HelpTrigger, {
              open: openHelp.skillsmp,
              label: t('helpShow'),
              controls: 'dsm-help-skillsmp',
              onToggle: () => toggleHelp('skillsmp'),
            }),
          ),
          openHelp.skillsmp
            ? h(
                'div',
                { className: 'dsm-help-panel', id: 'dsm-help-skillsmp', role: 'region' },
                helpLines(t('tipSkillsmp')),
              )
            : null,
          h('input', {
            id: 'dsm-mp',
            className: 'dsm-input',
            type: 'password',
            autoComplete: 'off',
            placeholder: configuredMp ? t('keepEmpty') : 'sk_live_…',
            value: settings.skillsmpKey,
            onChange: (event) => setSettings((prev) => ({ ...prev, skillsmpKey: event.target.value })),
          }),
          h('p', { className: 'dsm-hint' }, t('skillsmpKeyHint')),
        ),
        h(
          'div',
          { className: 'dsm-row', style: { marginTop: '14px' } },
          h('button', { type: 'button', className: 'dsm-btn', 'data-kind': 'primary', onClick: onSave, disabled: saving }, t('save')),
          configuredGithub ? h('button', { type: 'button', className: 'dsm-btn', onClick: () => onClear('githubToken') }, t('clear') + ' ' + t('githubToken')) : null,
          configuredMp ? h('button', { type: 'button', className: 'dsm-btn', onClick: () => onClear('skillsmpKey') }, t('clear') + ' ' + t('skillsmpKey')) : null,
        ),
        h('div', { className: 'dsm-section' }, h('h3', null, t('rootsTitle')), h('p', { className: 'dsm-hint' }, t('rootsHint'))),
        h(
          'div',
          { className: 'dsm-kv' },
          (status?.roots || []).flatMap((root) => [
            h('div', { key: root.id + '-k' }, root.label + (root.writable ? '' : ' (RO)')),
            h('div', { key: root.id + '-v', className: 'dsm-path' }, root.path),
          ]),
        ),
        h('p', { className: 'dsm-hint', style: { marginTop: '16px' } }, t('version', { v: status?.version || '0.1.0' })),
      )
    }

    function App(props) {
      const t = props.t || fallbackT
      const [tab, setTab] = useState('installed')
      const [status, setStatus] = useState(null)
      const [installed, setInstalled] = useState(null)
      const [loadingInstalled, setLoadingInstalled] = useState(true)
      const [globalError, setGlobalError] = useState('')
      const [filter, setFilter] = useState('')
      const [rootFilter, setRootFilter] = useState('all')
      const [toast, setToast] = useState('')
      const [dialog, setDialog] = useState(null)
      const [busyId, setBusyId] = useState('')
      const [busyUninstall, setBusyUninstall] = useState(false)
      const [saving, setSaving] = useState(false)
      const [settings, setSettings] = useState({ githubToken: '', skillsmpKey: '' })

      const emptyPlatform = () => ({ query: '', items: null, total: 0, page: 1, loading: false, error: '' })
      const [platforms, setPlatforms] = useState({ skillhub: emptyPlatform(), skillsmp: emptyPlatform() })
      const [repo, setRepo] = useState({ input: '', items: null, loading: false, error: '', owner: '', repo: '', branch: '' })

      const toastTimer = useRef(null)
      const showToast = useCallback((text) => {
        setToast(text)
        if (toastTimer.current) clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 2600)
      }, [])

      const loadInstalled = useCallback(async () => {
        setLoadingInstalled(true)
        try {
          const data = await call('installed')
          setInstalled(data.items || [])
          setGlobalError('')
        } catch (err) {
          setGlobalError(t('loadingFailed') + '：' + err.message)
        } finally {
          setLoadingInstalled(false)
        }
      }, [t])

      useEffect(() => {
        let alive = true
        ;(async () => {
          try {
            const data = await call('status')
            if (alive) setStatus(data)
          } catch (err) {
            if (alive) setGlobalError(t('loadingFailed') + '：' + err.message)
          }
        })()
        loadInstalled()
        return () => {
          alive = false
          if (toastTimer.current) clearTimeout(toastTimer.current)
        }
      }, [loadInstalled, t])

      const updatePlatform = (platform, patch) => {
        setPlatforms((prev) => ({ ...prev, [platform]: { ...prev[platform], ...(typeof patch === 'function' ? patch(prev[platform]) : patch) } }))
      }

      const runSearch = async (platform, page) => {
        const current = platforms[platform]
        const query = current.query.trim()
        if (platform === 'skillsmp' && !query) {
          updatePlatform(platform, { error: t('noQuery'), items: current.items })
          return
        }
        updatePlatform(platform, { loading: true, error: '', page })
        try {
          const data = await call('search', { platform, query, page, limit: 12 })
          updatePlatform(platform, (prev) => ({
            loading: false,
            items: page > 1 ? [...(prev.items || []), ...data.items] : data.items,
            total: data.total,
            page,
          }))
        } catch (err) {
          updatePlatform(platform, { loading: false, error: err.message })
        }
      }

      const doInstall = async (card, overwrite) => {
        const key = card.platform + ':' + card.id
        setBusyId(key)
        setDialog(null)
        try {
          const result = await call('install', { spec: card.spec, overwrite: Boolean(overwrite) })
          showToast(t('installedToast', { name: result.name }))
          await loadInstalled()
          const platform = card.platform === 'skillsmp' ? 'skillsmp' : card.platform === 'skillhub' ? 'skillhub' : null
          if (platform) {
            updatePlatform(platform, (prev) => ({
              items: (prev.items || []).map((item) =>
                item.id === card.id || item.name.toLowerCase() === String(result.name).toLowerCase()
                  ? { ...item, installed: true }
                  : item,
              ),
            }))
          } else {
            setRepo((prev) => ({
              ...prev,
              items: (prev.items || []).map((item) =>
                item.id === card.id || item.name.toLowerCase() === String(result.name).toLowerCase()
                  ? { ...item, installed: true }
                  : item,
              ),
            }))
          }
        } catch (err) {
          if (err.code === 'EEXIST') {
            setDialog({ type: 'overwrite', card })
          } else {
            setGlobalError(err.message)
          }
        } finally {
          setBusyId('')
        }
      }

      const onInstall = (card) => {
        setGlobalError('')
        doInstall(card, false)
      }

      const askUninstall = (item) => {
        setGlobalError('')
        setDialog({ type: 'uninstall', item })
      }

      const confirmDialog = async () => {
        if (!dialog) return
        if (dialog.type === 'uninstall') {
          setBusyUninstall(true)
          try {
            await call('uninstall', { rootId: dialog.item.rootId, dirName: dialog.item.dirName })
            showToast(t('uninstalledToast', { name: dialog.item.name }))
            setDialog(null)
            await loadInstalled()
          } catch (err) {
            setGlobalError(err.message)
            setDialog(null)
          } finally {
            setBusyUninstall(false)
          }
          return
        }
        if (dialog.type === 'overwrite') {
          doInstall(dialog.card, true)
        }
      }

      const scanRepo = async () => {
        const input = repo.input.trim()
        if (!input) {
          setRepo((prev) => ({ ...prev, error: t('fillFirst') }))
          return
        }
        setRepo((prev) => ({ ...prev, loading: true, error: '' }))
        try {
          const data = await call('repoScan', { input })
          setRepo((prev) => ({
            ...prev,
            loading: false,
            items: data.items || [],
            owner: data.owner,
            repo: data.repo,
            branch: data.branch,
          }))
        } catch (err) {
          setRepo((prev) => ({ ...prev, loading: false, error: err.message, items: null }))
        }
      }

      const saveSettings = async () => {
        if (!settings.githubToken && !settings.skillsmpKey) {
          showToast(t('fillFirst'))
          return
        }
        setSaving(true)
        try {
          const patch = {}
          if (settings.githubToken) patch.githubToken = settings.githubToken
          if (settings.skillsmpKey) patch.skillsmpKey = settings.skillsmpKey
          const data = await call('config', { save: patch })
          setStatus((prev) => ({ ...(prev || {}), config: data }))
          setSettings({ githubToken: '', skillsmpKey: '' })
          showToast(t('savedToast'))
        } catch (err) {
          setGlobalError(err.message)
        } finally {
          setSaving(false)
        }
      }

      const clearCredential = async (field) => {
        setSaving(true)
        try {
          const data = await call('config', { save: { [field]: '' } })
          setStatus((prev) => ({ ...(prev || {}), config: data }))
          showToast(t('savedToast'))
        } catch (err) {
          setGlobalError(err.message)
        } finally {
          setSaving(false)
        }
      }

      const roots = status?.roots || []
      const count = (installed || []).length
      const tabs = [
        { id: 'installed', label: t('tabInstalled') },
        { id: 'skillhub', label: t('tabSkillhub') },
        { id: 'skillsmp', label: t('tabSkillsmp') },
        { id: 'github', label: t('tabGithub') },
        { id: 'settings', label: t('tabSettings') },
      ]

      let body = null
      if (tab === 'installed') {
        body = h(InstalledView, {
          t,
          items: installed,
          roots,
          loading: loadingInstalled,
          filter,
          setFilter,
          rootFilter,
          setRootFilter,
          onUninstall: askUninstall,
        })
      } else if (tab === 'skillhub' || tab === 'skillsmp') {
        const hint = tab === 'skillhub' ? t('searchHintSkillhub') : t('searchHintSkillsmp')
        body = h(SearchView, {
          t,
          platform: tab,
          state: platforms[tab],
          hint,
          busyId,
          onQueryChange: (value) => updatePlatform(tab, { query: value }),
          onSearch: () => runSearch(tab, 1),
          onMore: () => runSearch(tab, (platforms[tab].page || 1) + 1),
          onInstall,
        })
      } else if (tab === 'github') {
        body = h(RepoView, {
          t,
          state: repo,
          busyId,
          setInput: (value) => setRepo((prev) => ({ ...prev, input: value })),
          onScan: scanRepo,
          onInstall,
        })
      } else {
        body = h(SettingsView, { t, status, settings, setSettings, onSave: saveSettings, onClear: clearCredential, saving })
      }

      return h(
        'div',
        { className: 'dsm-page' },
        h(
          'div',
          { className: 'dsm-head' },
          h(
            'div',
            { className: 'dsm-headrow' },
            h(
              'div',
              { className: 'dsm-title' },
              t('title'),
              h('span', { className: 'dsm-sub' }, t('subtitle', { n: count })),
            ),
            h(
              'button',
              { type: 'button', className: 'dsm-btn', onClick: loadInstalled, disabled: loadingInstalled },
              loadingInstalled ? t('loading') : t('refresh'),
            ),
          ),
          h(
            'nav',
            { className: 'dsm-tabs' },
            tabs.map((entry) =>
              h(
                'button',
                {
                  key: entry.id,
                  type: 'button',
                  className: 'dsm-tab',
                  'data-active': tab === entry.id ? 'true' : 'false',
                  onClick: () => setTab(entry.id),
                },
                entry.label,
              ),
            ),
          ),
        ),
        h('div', { className: 'dsm-body' }, h(Alert, { text: globalError }), body),
        toast ? h('div', { className: 'dsm-toast' }, toast) : null,
        dialog
          ? h(Dialog, {
              title:
                dialog.type === 'uninstall'
                  ? t('confirmDeleteTitle', { name: dialog.item.name })
                  : t('confirmOverwriteTitle', { name: dialog.card.name }),
              body:
                dialog.type === 'uninstall'
                  ? t('confirmDeleteBody', { path: dialog.item.path })
                  : t('confirmOverwriteBody'),
              confirmLabel: dialog.type === 'uninstall' ? t('deleteAction') : t('overwriteAction'),
              cancelLabel: t('cancel'),
              danger: dialog.type === 'uninstall',
              busy: dialog.type === 'uninstall' ? busyUninstall : Boolean(busyId),
              onCancel: () => setDialog(null),
              onConfirm: confirmDialog,
            })
          : null,
      )
    }

    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(() => {
        try {
          return ctx.locale.register(NS, { zh, en })
        } catch {
          return () => {}
        }
      }, 'skill-manager: dictionaries')
      ctx.effect(() => ensureCss(), 'skill-manager: style')

      const bindT = () => {
        try {
          if (ctx.locale && typeof ctx.locale.bind === 'function') return ctx.locale.bind(NS)
        } catch {}
        return fallbackT
      }

      const slots = ctx.slots
      if (!slots) return
      const label = () => bindT()('title')

      slots.inject('sidebar.panellist', () =>
        slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 30, label, locale: NS }, Icon),
      )
      slots.inject('main', () =>
        slots.register(
          { name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t: bindT() }) },
          (ownerProps) => h(App, { t: (ownerProps && ownerProps.t) || fallbackT }),
        ),
      )
    }

    return { inject, apply }
  },
})
