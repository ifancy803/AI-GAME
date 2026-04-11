import type { ArenaTheme, TileDefinition } from './types';

export const BOARD_SIZE = 7;

export const TILES: TileDefinition[] = [
  { id: 'ember', label: '熔芯', symbol: '✦' },
  { id: 'aqua', label: '流光', symbol: '◈' },
  { id: 'flora', label: '青枝', symbol: '✿' },
  { id: 'nova', label: '辉星', symbol: '⬢' },
  { id: 'pulse', label: '脉冲', symbol: '✶' },
  { id: 'void', label: '暗域', symbol: '⬟' },
];

export const THEMES: ArenaTheme[] = [
  {
    id: 'prism-port',
    name: 'Prism Port',
    strapline: '冷色玻璃舷窗与高亮战术面板',
    goalScore: 2100,
    rounds: 8,
    shellGradient: 'linear-gradient(135deg, rgba(27, 77, 122, 0.92), rgba(10, 17, 32, 0.94))',
    accent: '#74e4ff',
    accentSoft: '#4ec2ff',
    accentWarm: '#ffb970',
  },
  {
    id: 'amber-circuit',
    name: 'Amber Circuit',
    strapline: '暖色霓虹与高能态 AI 决策流',
    goalScore: 2400,
    rounds: 8,
    shellGradient: 'linear-gradient(135deg, rgba(95, 48, 18, 0.94), rgba(16, 12, 24, 0.94))',
    accent: '#ffc469',
    accentSoft: '#ff8f63',
    accentWarm: '#ffd68a',
  },
  {
    id: 'bloom-array',
    name: 'Bloom Array',
    strapline: '柔和绿蓝渐层与极简战斗仪表',
    goalScore: 2600,
    rounds: 9,
    shellGradient: 'linear-gradient(135deg, rgba(22, 87, 84, 0.92), rgba(10, 18, 33, 0.96))',
    accent: '#75f0c2',
    accentSoft: '#56d0ff',
    accentWarm: '#ffe0a1',
  },
];
