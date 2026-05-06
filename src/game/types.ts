export type Side = 'left' | 'right';

export type InputState = {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  hit: boolean;
  serve: boolean;
};

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
