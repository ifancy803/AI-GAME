# AI Match-3 Arena

一个基于 `Phaser 4 + TypeScript + Vite` 的 2D AI 智能 Match-3 Web 游戏，开箱可直接部署到静态站点。

## 核心特性

- 网格系统与程序化关卡生成
- 拖拽交换与连锁消除
- Phaser Tween 驱动的交换、掉落、补位、UI 动画
- Phaser 粒子特效
- AI 对手：贪心排序 + Minimax 搜索实时决策
- AI 难度自适应：玩家连胜后，AI 的 Minimax 深度自动 +1（带上限）
- AI Hint 系统：高亮当前最优玩家移动
- AI 决策可视化面板：文字说明 + 棋盘箭头 + 首轮命中预览
- 玩家 / AI 双方分数与回合数
- 程序化音效与增强粒子特效
- 手机触屏点选/拖拽交换，PC 横屏布局适配
- 中英文界面自由切换
- 无外部美术依赖，全部纹理由 Phaser 动态生成

## 运行

```bash
npm install
npm run dev
```

构建生产包：

```bash
npm run build
```

预览构建结果：

```bash
npm run preview
```

## 技术栈

- `phaser@beta` (`4.0.0-rc.7`)
- `typescript`
- `vite`

## 项目结构

```text
AI GAME/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ main.ts
│  ├─ style.css
│  └─ game/
│     ├─ Game.ts
│     ├─ Board.ts
│     ├─ Tile.ts
│     ├─ AIPlayer.ts
│     ├─ I18n.ts
│     ├─ LevelGenerator.ts
│     ├─ SoundController.ts
│     └─ types.ts
└─ README.md
```

## 代码职责

- `src/game/Game.ts`
  游戏场景、HUD、按钮、关卡流程、AI 回合控制、竖屏布局。

- `src/game/Board.ts`
  网格状态、交换逻辑、匹配检测、下落补位、粒子表现、拖拽输入、确定性随机数与纯逻辑模拟。

- `src/game/Tile.ts`
  单个方块对象，封装缩放、高亮、拖拽反馈。

- `src/game/AIPlayer.ts`
  AI 决策器。先按贪心分数排序候选步，再用 Minimax 做双边评分，并输出可视化思考路线。

- `src/game/I18n.ts`
  中英文翻译表与界面文本格式化工具。

- `src/game/LevelGenerator.ts`
  程序化生成关卡尺寸、颜色数、目标分、AI 思考时间和视觉主题。

- `src/game/SoundController.ts`
  基于 Web Audio API 的轻量程序化音效控制器。

## AI 设计

- `Board.simulateMove(...)` 使用确定性随机数模拟：
  - 交换
  - 匹配
  - 清除
  - 下落
  - 补位
  - 连锁

- `AIPlayer` 工作流：
  1. 列出所有合法移动
  2. 用首轮消除得分做贪心排序
  3. 截断前若干强分支
  4. 使用 2 层 Minimax 评估 AI 与玩家的轮替收益

- 自适应难度：
  - 玩家连续通关后，AI 搜索深度会提升
  - 默认基础深度为 2
  - 为保证实时响应，深度设置了合理上限

这种实现让 AI 对手和 Hint 系统共享同一套纯逻辑推演，结果稳定且一致。

## 交互说明

- 拖拽任意方块到相邻方向即可交换
- 触屏上也可以先点选一颗宝石，再点相邻宝石完成交换
- 底部 `AI Hint` 按钮会高亮当前最优玩家移动
- AI 回合会显示候选路线、箭头方向与首轮命中组合预览
- 右上角按钮可随时切换中英文
- 玩家与 AI 轮流操作，共享同一棋盘
- 每关都需要在回合耗尽前尽量压过 AI，并达到目标分数

## 部署

项目输出为纯静态资源，`npm run build` 后生成在 `dist/`，可直接部署到：

- Vercel
- Netlify
- GitHub Pages
- 任意 Nginx / 静态文件服务器
