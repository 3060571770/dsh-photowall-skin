# dsh-photowall-skin

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/3060571770/dsh-photowall-skin)](https://github.com/3060571770/dsh-photowall-skin/releases)
[![CI](https://github.com/3060571770/dsh-photowall-skin/actions/workflows/ci.yml/badge.svg)](https://github.com/3060571770/dsh-photowall-skin/actions)

DeepSeek Harness（DSH）皮肤插件：上传你自己的图片作为**画廊作品墙**与**侧栏轮播**背景，配上可自定义的**玻璃拟态配色**。**不内置任何图片**——装好后到「设置 → 🎨 皮肤」上传即可，作品墙随图片数量自适应。

> 零核心代码改动：完全通过 DSH 官方插件机制（`shell.overlay` 画布层、`settings` 插槽、`theme.overrideTokens()` 主题扩展点）实现；卸载后界面完整恢复默认。

## 界面预览

<!-- 有截图后放入 docs/ 并替换此处
| 画廊设置 | 漂移墙效果 |
| --- | --- |
| ![画廊设置](docs/screenshot-gallery.png) | ![漂移墙](docs/screenshot-drift.png) |
-->

## 功能

**画廊背景墙** —— 漂移、静态拼图、单图全屏三种模式，深浅主题独立配置：

- **漂移**：行数（1–6）与速度（90–120 秒/圈）可调，各行反向匀速循环；
- **静态**：行数可调，每排张数随「图片数 ÷ 行数」自适应铺满，不固定列数；
- **单图**：每个主题单独指定一张全屏作品。

**侧栏背景轮播** —— 深浅主题各维护一份图片列表：单选静态显示、多选按序交叉淡入淡出，轮播间隔可调。

**自定义上传** —— JPG / PNG / WebP（≤ 12 MB），支持一次多选或拖入多张，上传后自动加入当前主题；可删除、排序、拖拽排序。作品全部保存在本机，不会外发。

**界面配色** —— 快速配色（每个主题一个主色 + 整体透明度）自动生成整套玻璃界面；支持逐 token 细调与自定义预设，深浅主题独立。

**安全模式** —— 一键隐藏全部作品背景，只保留配色。

**中英双语**设置界面，跟随系统深浅色自动切换。

## 安装

通过 DSH 官方插件命令安装（会自动注册到 profile 的 bundle 层并启用）：

```sh
# 从 GitHub Releases 下载 .tgz 后用本地路径安装
dsh plugin --profile web add ./dsh-photowall-skin-0.5.0.tgz

# 或发布到 npm / Git 后按包名安装
dsh plugin --profile web add dsh-photowall-skin
```

装完重启 `dsh web`，刷新页面，皮肤即出现在「设置 → 🎨 皮肤」。

> ⚠️ 不要手动把包解压进 `node_modules`——DSH 只加载 `dsh.profile.bundles` 里显式列出的插件。

卸载：`dsh plugin --profile web remove dsh-photowall-skin`

## 使用

1. 打开 WebUI，进入「设置 → 🎨 皮肤」。
2. **画廊**：上传图片 → 选择漂移 / 静态 / 单图模式 → 调整行数与速度 → 勾选要展示的作品。
3. **侧栏**：勾选图片作侧栏背景（单选静态、多选轮播）。
4. **配色**：选择主题主色与整体透明度，或逐 token 细调并保存为预设。

所有修改实时生效，无需保存。

## 工作原理

| 能力     | 机制                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------- |
| 画廊背景 | 通过 `shell.overlay` 注入画布层（drift / static / single 三种），浅/深模式自动切换              |
| 侧栏背景 | 双图层 CSS 背景交叉淡入淡出，图片 URL 由运行时写入 CSS 变量                                     |
| 界面配色 | `theme.overrideTokens()` 覆写 `--dsw-alias-*` 语义 token，按模式推导派生色                      |
| 图片上传 | Host 端 `/photowall-skin/api/upload`，校验格式与体积，落盘到 profile 的 `uploads/` 并持久化清单 |
| 作品解析 | 无内置图包；画廊/侧栏只从用户上传清单解析，失效 ID 自动忽略                                     |

## 许可证

[MIT](./LICENSE) © 2026 Levi
