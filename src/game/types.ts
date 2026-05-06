export type Side = 'left' | 'right';

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  hit: boolean;
  serve: boolean;
};

export type InputAction = keyof InputState;

export type InputBindings = Record<InputAction, string>;

export type AiDifficulty = 'easy' | 'normal' | 'hard';

export type Entity = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type Player = Entity & {
  side: Side;
  isCpu: boolean;
  onGround: boolean;
  facing: -1 | 1;
  hitCooldown: number;
  touchCooldown: number;
  color: number;
  accent: number;
};

export type Ball = Entity & {
  radius: number;
  visible: boolean;
};

export type MatchState = 'idle' | 'waitingServe' | 'playing' | 'gameOver';

export type Score = {
  player: number;
  cpu: number;
};

export type NetCollision = {
  pointX: number;
  pointY: number;
  normalX: number;
  normalY: number;
  penetration: number;
  source: 'alpha' | 'fallback';
};

export type NetMaskDebugPixel = {
  x: number;
  y: number;
  size: number;
};

export type HitboxDebugFrame = {
  enabled: boolean;
  ball: Ball;
  netMaskPixels: NetMaskDebugPixel[];
  fallbackNet: {
    x: number;
    top: number;
    bottom: number;
    radius: number;
  };
  collision: NetCollision | null;
};
