# Prism Protocol

[Play online](https://pub-a3f0d0474a704359a03182254cf3d8ca.r2.dev/index.html)

Prism Protocol is a match-3 battle game built with TypeScript, Vite, and native DOM UI. This redesigned frontend no longer depends on Phaser. Its modular architecture combines a complete game rules engine with custom AI for path analysis, action selection, and move ranking.

## Features

- Modular TypeScript architecture with a dedicated game engine and state management.
- Match resolution covering swaps, clears, falling pieces, and refills.
- Custom AI that analyzes candidate moves and ranks promising actions.
- Dark glass-inspired interface with layered gradients and theme switching.
- Live dashboards for player-versus-AI scores, objectives, top AI choices, turn pacing, and recent actions.
- Responsive layouts for desktop and mobile screens.

## Project Structure

```text
src/
├── app/        # Page composition, event handling, and AI turn scheduling
├── core/       # Lightweight state management
├── game/       # Rules engine, AI, board configuration, state, and domain types
├── ui/         # Board and dashboard rendering
├── main.ts
└── style.css   # Visual system
```

## Run Locally

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

---

# Prism Protocol

[在线试玩](https://pub-a3f0d0474a704359a03182254cf3d8ca.r2.dev/index.html)

Prism Protocol 是一款使用 TypeScript、Vite 和原生 DOM UI 构建的三消对战游戏。新版前端不再依赖 Phaser，而是通过模块化架构，将完整的游戏规则引擎与自研 AI 结合，实现路径分析、行动选择和走法排序。

## 功能特性

- 采用模块化 TypeScript 架构，包含独立的游戏引擎与状态管理。
- 完整处理交换、消除、方块下落与补位等规则。
- 自研 AI 可分析候选走法并为潜在行动排序。
- 深色玻璃质感界面、多层渐变背景与主题切换。
- 实时数据面板展示玩家与 AI 的得分、目标进度、AI 优选行动、回合节奏和近期操作。
- 适配桌面端与移动端的响应式布局。

## 项目结构

```text
src/
├── app/        # 页面组装、事件处理与 AI 回合调度
├── core/       # 轻量级状态管理
├── game/       # 规则引擎、AI、棋盘配置、状态与领域类型
├── ui/         # 棋盘和数据面板渲染
├── main.ts
└── style.css   # 视觉系统
```

## 本地运行

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```
