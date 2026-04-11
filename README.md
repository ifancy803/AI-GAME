# Prism Protocol

一个完全重构后的前端版本：不再依赖 `Phaser`，改为 `TypeScript + Vite + 原生 DOM UI` 的模块化架构，用更简洁的界面和更直接的可视化方式承载整套 Match-3 对战体验。

## 新架构

```text
src/
├─ app/
│  └─ App.ts              # 组装页面、控制事件、调度 AI 回合
├─ core/
│  └─ store.ts            # 轻量状态管理
├─ game/
│  ├─ ai.ts               # AI 路线分析与候选排序
│  ├─ config.ts           # 棋盘与主题配置
│  ├─ engine.ts           # 纯规则引擎：交换、消除、掉落、补位
│  ├─ store.ts            # 游戏状态与动作
│  └─ types.ts            # 领域模型类型
├─ ui/
│  ├─ BoardView.ts        # 棋盘渲染
│  └─ DashboardView.ts    # 侧边数据面板与可视化信息
├─ main.ts
└─ style.css              # 全新视觉系统
```

## 视觉与交互

- 深色玻璃化主界面与多层渐变背景
- 全新棋盘样式、主题切换和数据仪表面板
- 玩家 / AI 分数对抗条、目标进度条、AI Top 3 决策雷达
- 回合节奏图与最近动作流，方便快速判断局势
- 移动端和桌面端自适应布局

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

本次重构已经移除了旧的 `Phaser` 依赖，当前前端完全基于新的模块化实现运行。
