# B站视频倍速控制器

[![Install on Greasy Fork](https://img.shields.io/badge/安装脚本-Greasy_Fork-ea4335?style=flat-square)](https://greasyfork.org/scripts/561015) [![GitHub Repo](https://img.shields.io/badge/GitHub-仓库-1890ff?style=flat-square)](https://github.com/codertesla/bilibili-video-speed-controller-userscript) [![MIT License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](https://github.com/codertesla/bilibili-video-speed-controller-userscript/blob/main/LICENSE)

这是针对 Bilibili 的视频倍速控制器油猴（Tampermonkey/Greasemonkey）脚本。

## 📸 预览

![速度设置面板](https://raw.githubusercontent.com/codertesla/bilibili-video-speed-controller-userscript/refs/heads/main/images/ui.avif)

## 📦 安装方法

### 方法一：GreasyFork 安装（推荐）
1. 确保已安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Greasemonkey](https://www.greasespot.net/)
2. 访问 **[GreasyFork 脚本页面](https://greasyfork.org/scripts/561015)**
3. 点击绿色的「安装此脚本」按钮

### 方法二：手动安装
1. 打开 Tampermonkey 管理面板
2. 点击「新建脚本」
3. 将 `bilibili-speed-controller.user.js` 的内容复制粘贴进去
4. 保存（Ctrl+S / Cmd+S）

## 相关推荐脚本

这些也是我写的 Bilibili / B 站油猴脚本，可以按需搭配使用：

| 脚本 | 适合场景 | 安装 | 源码 |
| :--- | :--- | :--- | :--- |
| Bilibili 增强进度条 | 暂停视频时显示当前进度条，可切换为永久显示，并展示已缓冲进度。 | [Greasy Fork](https://greasyfork.org/scripts/585382) | [GitHub](https://github.com/codertesla/bilibili-enhanced-progress-bar) |
| B 站嘴替小助手 | 根据当前视频内容调用 AI 生成一条可编辑的中文评论，适合想快速起草评论时使用。 | [Greasy Fork](https://greasyfork.org/scripts/583255) | [GitHub](https://github.com/codertesla/bili-comment-buddy) |
| Bilibili 快捷评论发布 | 在视频页、番剧页和列表播放页使用 `Cmd+Enter` / `Ctrl+Enter` 快速发布评论。 | [Greasy Fork](https://greasyfork.org/zh-CN/scripts/565212-bilibili-%E5%BF%AB%E6%8D%B7%E8%AF%84%E8%AE%BA%E5%8F%91%E5%B8%83) | [GitHub](https://github.com/codertesla/EasyComment) |
| B站一键拉黑 UP 主 | 在首页、搜索页和视频页快速拉黑 UP 主，并支持屏蔽视频卡片、直播卡片、广告和运营推广。 | [Greasy Fork](https://greasyfork.org/zh-CN/scripts/529390-bilibili-b%E7%AB%99%E4%B8%80%E9%94%AE%E6%8B%89%E9%BB%91up%E4%B8%BB-%E5%B1%8F%E8%94%BD%E8%A7%86%E9%A2%91%E4%B8%8E%E5%B9%BF%E5%91%8A) | [GitHub](https://github.com/codertesla/bilibili-1-click-blocker) |

## ✨ 功能特性

- 🎬 **专为 B站 优化** - 深度适配 B站 播放器
- 💾 **记住设置** - 速度设置会自动保存
- 🔄 **自动应用** - 打开视频自动设置为默认倍速
- 🖱️ **手动倍速检测** - 检测到用户手动调速后暂停自动应用
- ⌨️ **快捷键控制** - 支持 YouTube 风格快捷键（`Shift+>` / `Shift+<` / `/`）
- 🎛️ **极简设置面板** - 简约黑白灰风格面板，支持点选和滑杆调节
- 🧠 **位置记忆** - 设置面板位置会自动保存
- 💬 **简约提示** - 倍速切换时显示极简 Toast 提示

## 🔧 使用方法

### 油猴菜单
在 Bilibili 视频页面，点击油猴图标，可以看到以下菜单选项：

| 菜单项 | 说明 |
|--------|------|
| 📊 当前状态 | 点击打开视频上的调速面板；未找到播放器时显示当前速度、视频检测情况及快捷键列表 |
| ⚡ 启用/禁用 | 切换倍速功能开关 |
| ⚙️ 打开设置面板 | 打开极简设置面板 |

### 键盘快捷键（YouTube 风格）

| 快捷键 | 功能 |
|--------|------|
| `Shift + >` (或 `.`) | 增加 0.25x 倍速 |
| `Shift + <` (或 `,`) | 降低 0.25x 倍速 |
| `/` | 重置为 1.0x 倍速 |

### 设置面板功能
- **滑杆调节** - 拖动滑杆精确调节速度（0.1x - 3.0x），步进为 0.05x
- **加减按钮** - 点击面板中的 `+` / `-` 按钮按 0.05x 微调
- **快捷按钮** - 一键设置常用速度
- **拖动移动** - 拖动标题栏可移动面板位置
- **ESC 关闭** - 按 ESC 键或点击遮罩关闭面板

### 倍速步进说明

| 操作方式 | 步进 |
|----------|------|
| 滑杆拖动 | 0.05x |
| 面板 `+` / `-` 按钮 | 0.05x |
| `Shift + >` / `Shift + <` 快捷键 | 0.25x |
| 快捷按钮 | 直接切换到对应预设值 |

## ⚙️ 默认设置

- **默认速度**: 1.5x

## 📝 更新日志

### v1.6.8 (2026-07-08)
- **移除右上角 × 关闭按钮**：由于 B 站原生菜单限制，无法可靠实现内部关闭按钮；关闭改回 B 站原生行为（点击外部 / 鼠标移开）
- **油猴菜单「当前状态」现在打开调速面板**：点击油猴下拉菜单的「当前状态: X.XXx」会直接呼出视频上的倍速调节面板；若未找到播放器则回退显示状态信息

### v1.6.7 (2026-07-08)
- **修复右上角 × 关闭按钮无效**：改为在 `document.body` 上模拟外部点击（B 站原生菜单关闭机制），并兜底移除 `bpx-player-ctrl-playbackrate-open` 显隐 class

### v1.6.6 (2026-07-08)
- **原生倍速面板 UI 重构**：采用更简洁的单行布局，超大居中速度显示
- **预设精简**：8 格网格改为 5 个单行药丸按钮（1.0 / 1.25 / 1.5 / 2 / 3），去掉 `x` 后缀
- **新增精确速度输入框**：可直接输入任意倍速值
- **关闭方式调整**：返回箭头改为右上角 `×` 关闭符号，默认速度移至标题副标题

### v1.5.0 (2026-05-12)
- **修复手动倍速检测竞争条件**：改用 `expectedRates` 映射识别脚本自身的 `ratechange`，避免误判为用户操作
- **SPA 路由适配**：监听 `pushState`/`replaceState`/`popstate`，切换视频时自动重置状态并重新应用倍速
- **存储写入防抖**：拖动滑杆时不再每次 input 都同步写入 `GM_setValue`
- **内存优化**：`observedVideos`/`videoSources`/`manualOverrides` 改用 WeakSet/WeakMap，允许视频元素被 GC
- **卸载清理**：`pagehide` 时销毁设置面板、Toast、快捷键监听，替换不可靠的 `beforeunload`
- **拖动改用 Pointer Events**：支持触控/触控板，`setPointerCapture` 防止鼠标移出窗口时卡住
- **菜单标题动态刷新**：状态变化后重新注册菜单项
- **样式注入幂等**：避免重复注入
- **清理 YouTube 遗留**：移除多平台抽象与无效代码

### v1.4.2 (2026-01-29)
- **Toast 提示优化**：增大尺寸、字体和边距，提升清晰度

### v1.4.1 (2026-01-28)
- **Toast 位置优化**：修复全屏模式下 Toast 可能被遮挡的问题，使其跟随视频元素显示

### v1.4.0 (2026-01-26)
- **新增键盘快捷键**：支持 YouTube 风格的快捷键控制倍速
- **UI 重构**：全面转向极简黑白灰风格，移除渐变色和冗余装饰
- **Toast 优化**：引入极简 Toast 提示，快速反馈倍速变化
- **预设微调**：增加 0.75x 预设，填满 8 格布局

### v1.3.0 (2026-01-26)
- 内部功能迭代与优化

### v1.2.0 (2026-01-09)
- 新增悬浮设置面板，支持滑杆调节速度
- 精简油猴菜单（从 10 项减少为 3 项）
- 添加快捷按钮和面板拖动功能
- 支持面板位置记忆

### v1.1.1 (2026-01-01)
- 重命名脚本为 `bilibili-speed-controller.user.js`
- 独立为 Bilibili 专用仓库

### v1.1.0 (2026-01-01)
- 精简脚本，变为 Bilibili 专版
- 移除其他平台相关代码
- 将预设倍速常量移至脚本顶部，方便修改
- 更新默认倍速为 1.5x

### v1.0.0 (2025-12-30)
- 从 Chrome 插件迁移为油猴脚本
- 保留所有核心功能
- 使用 GM_getValue/GM_setValue 替代 chrome.storage
- 使用 GM_registerMenuCommand 提供设置界面

## 🔗 相关链接

- [问题反馈](https://github.com/codertesla/bilibili-video-speed-controller-userscript/issues)

## 📄 许可证

MIT License
