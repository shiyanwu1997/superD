# 登录页 Logo 布局调整设计

**日期：** 2026-09-02
**状态：** 已获用户批准（方案 3：黑底胶囊含图标）

## 问题

登录页顶部标识为"圆形 S 图标"单独一行居中、"Supervisor"标题在下一行，视觉上图标与文字割裂、不对齐。

## 方案（用户在三种预览中选定方案 3）

登录页顶部改为**黑底胶囊**：黑底圆角胶囊行内，白底圆形 S 图标 + 白色粗体 "Supervisor" 同一行居中；副标题"进程管理平台"保持在下方灰色小字。

从预览页定稿的样式（LogoPreviewPage.jsx 方案 3 卡片）：

```jsx
<div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#111', padding: '8px 24px 8px 10px', borderRadius: 999 }}>
  <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="19" stroke="#fff" strokeWidth="2" fill="#fff" />
    <text x="20" y="27" textAnchor="middle" fill="#111" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">S</text>
  </svg>
  <span style={{ color: '#fff', fontWeight: 700, fontSize: 20, letterSpacing: '-.3px' }}>Supervisor</span>
</div>
```

## 改动范围

- `client/src/pages/LoginPage.jsx`：顶部标识区替换为上述胶囊（替换 `<Logo size={48} showText={false} />` + `Title` 两行结构；副标题 Text 保留）
- `client/src/components/Logo.jsx`：**不改**（侧边栏继续用现有黑圆白 S + 黑字横排）
- 临时文件清理：删除 `client/src/pages/LogoPreviewPage.jsx`、App.jsx 中的预览路由、api.js 401 拦截器中的 `/logo-preview` 豁免

## 测试

- vitest（jsdom）：LoginPage 渲染后，logo 区存在黑底胶囊（class 或 style 标记）且包含 "Supervisor" 文本与 S 图标 svg 同一 flex 行
- Playwright 截图对比（人工确认）

## 范围外（YAGNI）

- 不改侧边栏 Logo
- 不抽公共组件（仅登录页用）
