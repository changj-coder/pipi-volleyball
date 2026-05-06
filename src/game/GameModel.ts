import {
  BALL_BOUNCE,
  BALL_GRAVITY,
  BALL_MAX_SPEED_X,
  BALL_MAX_SPEED_Y,
  BALL_PLAYER_BOUNCE,
  BALL_POWER_BONUS,
  BALL_POWER_MAX_SPEED_X,
  BALL_POWER_MAX_SPEED_Y,
  BALL_POWER_SPEED_X,
  BALL_POWER_SPEED_Y,
  BALL_RADIUS,
  GAME_WIDTH,
  GROUND_Y,
  NET_WIDTH,
  NET_X,
  PLAYER_FAST_FALL,
  PLAYER_GRAVITY,
  PLAYER_GROUND_Y,
  PLAYER_HITBOX_OFFSET_Y,
  PLAYER_HITBOX_RADIUS_X,
  PLAYER_HITBOX_RADIUS_Y,
  PLAYER_JUMP_SPEED,
  PLAYER_RADIUS_X,
  PLAYER_RADIUS_Y,
  PLAYER_SPEED,
  WINNING_SCORE,
} from './constants';
import {
  createFallbackNetDebug,
  createFallbackNetCollision,
  NetCollisionMask,
} from './NetCollisionMask';
import type {
  Ball,
  HitboxDebugFrame,
  InputState,
  MatchState,
  NetCollision,
  Player,
  Score,
  Side,
} from './types';

type TickResult = {
  scoredBy: Side | null;
  hit: boolean;
  gameOver: boolean;
};

export class GameModel {
  readonly player: Player = this.createPlayer('left', false, 0x2f74c0, 0xffffff);
  readonly cpu: Player = this.createPlayer('right', true, 0xd8584d, 0xffffff);
  readonly ball: Ball = { x: -100, y: -100, vx: 0, vy: 0, radius: BALL_RADIUS, visible: false };
  readonly score: Score = { player: 0, cpu: 0 };

  state: MatchState = 'idle';
  servingSide: Side = 'left';
  roundMessage = '按「開始」進入比賽';
  private netCollisionMask: NetCollisionMask | null = null;
  private lastNetCollision: NetCollision | null = null;
  private lastNetCollisionFrames = 0;

  setNetCollisionMask(mask: NetCollisionMask | null): void {
    this.netCollisionMask = mask;
  }

  getHitboxDebugFrame(enabled: boolean): HitboxDebugFrame {
    return {
      enabled,
      ball: this.ball,
      netMaskPixels: enabled && this.netCollisionMask ? this.netCollisionMask.getDebugPixels() : [],
      fallbackNet: this.netCollisionMask?.getFallbackDebug() ?? createFallbackNetDebug(),
      collision: enabled && this.lastNetCollisionFrames > 0 ? this.lastNetCollision : null,
    };
  }

  start(): void {
    this.score.player = 0;
    this.score.cpu = 0;
    this.servingSide = 'left';
    this.state = 'waitingServe';
    this.roundMessage = '按 Enter，球會從玩家半場落下';
    this.resetPlayers();
    this.hideBall();
  }

  restart(): void {
    this.start();
  }

  tick(playerInput: InputState, cpuInput: InputState): TickResult {
    const result: TickResult = {
      scoredBy: null,
      hit: false,
      gameOver: false,
    };

    if (this.state === 'idle' || this.state === 'gameOver') {
      return result;
    }

    if (this.state === 'waitingServe') {
      this.updatePlayer(this.player, playerInput);
      this.updatePlayer(this.cpu, cpuInput);
      if (playerInput.serve) {
        this.launchServe();
      }
      return result;
    }

    this.updatePlayer(this.player, playerInput);
    this.updatePlayer(this.cpu, cpuInput);
    this.updateBall();
    result.hit = this.resolvePlayerBallCollision(this.player, playerInput);
    result.hit = this.resolvePlayerBallCollision(this.cpu, cpuInput) || result.hit;

    const scoredBy = this.checkScore();
    if (scoredBy) {
      result.scoredBy = scoredBy;
      this.applyScore(scoredBy);
      result.gameOver =
        this.score.player >= WINNING_SCORE || this.score.cpu >= WINNING_SCORE;
    }

    return result;
  }

  private createPlayer(
    side: Side,
    isCpu: boolean,
    color: number,
    accent: number
  ): Player {
    return {
      side,
      isCpu,
      x: side === 'left' ? 62 : GAME_WIDTH - 62,
      y: PLAYER_GROUND_Y,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: side === 'left' ? 1 : -1,
      hitCooldown: 0,
      touchCooldown: 0,
      color,
      accent,
    };
  }

  private resetPlayers(): void {
    this.player.x = 64;
    this.player.y = PLAYER_GROUND_Y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = true;
    this.player.hitCooldown = 0;
    this.player.touchCooldown = 0;
    this.player.facing = 1;

    this.cpu.x = GAME_WIDTH - 64;
    this.cpu.y = PLAYER_GROUND_Y;
    this.cpu.vx = 0;
    this.cpu.vy = 0;
    this.cpu.onGround = true;
    this.cpu.hitCooldown = 0;
    this.cpu.touchCooldown = 0;
    this.cpu.facing = -1;
  }

  private hideBall(): void {
    this.ball.visible = false;
    this.ball.x = -100;
    this.ball.y = -100;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  private launchServe(): void {
    const serveFromLeft = this.servingSide === 'left';
    this.ball.visible = true;
    this.ball.x = serveFromLeft ? 82 : GAME_WIDTH - 82;
    this.ball.y = 28;
    this.ball.vx = serveFromLeft ? 1.08 : -1.08;
    this.ball.vy = 0.2;
    this.state = 'playing';
    this.roundMessage = '先拿 5 分獲勝';
  }

  private updatePlayer(player: Player, input: InputState): void {
    const minX = player.side === 'left' ? PLAYER_RADIUS_X : NET_X + NET_WIDTH / 2 + PLAYER_RADIUS_X;
    const maxX = player.side === 'left' ? NET_X - NET_WIDTH / 2 - PLAYER_RADIUS_X : GAME_WIDTH - PLAYER_RADIUS_X;

    player.vx = 0;
    if (input.left) {
      player.vx -= PLAYER_SPEED;
      player.facing = -1;
    }
    if (input.right) {
      player.vx += PLAYER_SPEED;
      player.facing = 1;
    }

    if (input.up && player.onGround) {
      player.vy = PLAYER_JUMP_SPEED;
      player.onGround = false;
    }

    if (input.down && !player.onGround) {
      player.vy += PLAYER_FAST_FALL;
    }

    player.vy += PLAYER_GRAVITY;
    player.x = Math.max(minX, Math.min(maxX, player.x + player.vx));
    player.y += player.vy;

    if (player.y >= PLAYER_GROUND_Y) {
      player.y = PLAYER_GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }

    if (player.hitCooldown > 0) {
      player.hitCooldown -= 1;
    }

    if (player.touchCooldown > 0) {
      player.touchCooldown -= 1;
    }
  }

  private updateBall(): void {
    if (!this.ball.visible) {
      return;
    }

    if (this.lastNetCollisionFrames > 0) {
      this.lastNetCollisionFrames -= 1;
    }

    const stepCount = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(this.ball.vx), Math.abs(this.ball.vy)) / 5)
    );

    for (let step = 0; step < stepCount; step += 1) {
      this.ball.vy += BALL_GRAVITY / stepCount;
      this.ball.vx = clamp(this.ball.vx, -BALL_POWER_MAX_SPEED_X, BALL_POWER_MAX_SPEED_X);
      this.ball.vy = clamp(this.ball.vy, -BALL_POWER_MAX_SPEED_Y, BALL_POWER_MAX_SPEED_Y);
      this.ball.x += this.ball.vx / stepCount;
      this.ball.y += this.ball.vy / stepCount;
      this.resolveWorldCollision();
      this.resolveNetCollision();
    }
  }

  private resolveWorldCollision(): void {
    if (this.ball.x - BALL_RADIUS < 0) {
      this.ball.x = BALL_RADIUS;
      this.ball.vx = Math.abs(this.ball.vx) * BALL_BOUNCE;
    }

    if (this.ball.x + BALL_RADIUS > GAME_WIDTH) {
      this.ball.x = GAME_WIDTH - BALL_RADIUS;
      this.ball.vx = -Math.abs(this.ball.vx) * BALL_BOUNCE;
    }

    if (this.ball.y - BALL_RADIUS < 0) {
      this.ball.y = BALL_RADIUS;
      this.ball.vy = Math.abs(this.ball.vy) * BALL_BOUNCE;
    }
  }

  private resolveNetCollision(): void {
    const collision =
      this.netCollisionMask?.collideCircle(this.ball) ??
      (this.netCollisionMask ? null : createFallbackNetCollision(this.ball));

    if (!collision) {
      return;
    }

    this.lastNetCollision = collision;
    this.lastNetCollisionFrames = 12;
    this.ball.x += collision.normalX * (collision.penetration + 0.2);
    this.ball.y += collision.normalY * (collision.penetration + 0.2);

    const incomingSpeed =
      this.ball.vx * collision.normalX + this.ball.vy * collision.normalY;
    if (incomingSpeed >= 0) {
      return;
    }

    const bounce = 1 + BALL_BOUNCE;
    this.ball.vx -= bounce * incomingSpeed * collision.normalX;
    this.ball.vy -= bounce * incomingSpeed * collision.normalY;
    this.ball.vx = clamp(this.ball.vx, -BALL_POWER_MAX_SPEED_X, BALL_POWER_MAX_SPEED_X);
    this.ball.vy = clamp(this.ball.vy, -BALL_POWER_MAX_SPEED_Y, BALL_POWER_MAX_SPEED_Y);
  }

  private resolvePlayerBallCollision(player: Player, input: InputState): boolean {
    if (!this.ball.visible) {
      return false;
    }

    if (player.touchCooldown > 0) {
      return false;
    }

    const hitboxX = player.x;
    const hitboxY = player.y + PLAYER_HITBOX_OFFSET_Y;
    const dx = this.ball.x - hitboxX;
    const dy = this.ball.y - hitboxY;
    const combinedX = PLAYER_HITBOX_RADIUS_X + BALL_RADIUS;
    const combinedY = PLAYER_HITBOX_RADIUS_Y + BALL_RADIUS;

    if (Math.abs(dx) > combinedX || Math.abs(dy) > combinedY) {
      return false;
    }

    const normalizedX = dx / combinedX;
    const normalizedY = dy / combinedY;
    const length = Math.hypot(normalizedX, normalizedY) || 1;
    const nx = normalizedX / length;
    const ny = normalizedY / length;
    const isPowerHit = input.hit && player.hitCooldown <= 0;
    const bonus = isPowerHit ? BALL_POWER_BONUS : 0;
    const relativeVelocity = (this.ball.vx - player.vx) * nx + (this.ball.vy - player.vy) * ny;

    if (relativeVelocity > 0.35 && !isPowerHit) {
      return false;
    }

    this.ball.x = hitboxX + nx * combinedX;
    this.ball.y = hitboxY + ny * combinedY;
    this.ball.vx = clamp(
      nx * (BALL_PLAYER_BOUNCE + bonus) + player.vx * 0.42,
      -BALL_MAX_SPEED_X,
      BALL_MAX_SPEED_X
    );
    this.ball.vy = clamp(
      Math.min(ny * (BALL_PLAYER_BOUNCE + bonus), -0.6) - 1.0,
      -BALL_MAX_SPEED_Y,
      BALL_MAX_SPEED_Y
    );
    player.touchCooldown = 8;

    if (isPowerHit) {
      player.hitCooldown = 18;
      const aim = getPowerHitAim(player, input);
      this.ball.vx = clamp(aim.x, -BALL_POWER_MAX_SPEED_X, BALL_POWER_MAX_SPEED_X);
      this.ball.vy = clamp(aim.y, -BALL_POWER_MAX_SPEED_Y, BALL_POWER_MAX_SPEED_Y);
    }

    return true;
  }

  private checkScore(): Side | null {
    if (!this.ball.visible) {
      return null;
    }

    if (this.ball.y + BALL_RADIUS < GROUND_Y) {
      return null;
    }

    return this.ball.x < NET_X ? 'right' : 'left';
  }

  private applyScore(scoredBy: Side): void {
    if (scoredBy === 'left') {
      this.score.player += 1;
      this.roundMessage = '玩家得分';
    } else {
      this.score.cpu += 1;
      this.roundMessage = '電腦得分';
    }

    if (this.score.player < this.score.cpu) {
      this.servingSide = 'left';
    } else if (this.score.cpu < this.score.player) {
      this.servingSide = 'right';
    } else {
      this.servingSide = scoredBy === 'left' ? 'right' : 'left';
    }

    if (this.score.player >= WINNING_SCORE || this.score.cpu >= WINNING_SCORE) {
      this.state = 'gameOver';
      this.roundMessage = this.score.player > this.score.cpu ? '你贏了！按重來再戰' : '電腦獲勝，按重來再戰';
      return;
    }

    this.state = 'waitingServe';
    this.hideBall();
    this.resetPlayers();
    this.roundMessage = `${this.roundMessage}，按 Enter 從落後方發球`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPowerHitAim(player: Player, input: InputState): { x: number; y: number } {
  const defaultDirection = player.side === 'left' ? 1 : -1;
  let xDirection = input.left ? -1 : input.right ? 1 : defaultDirection;
  let yDirection = input.down ? 1 : -1;

  if (input.up) {
    yDirection = -1;
  }

  if (player.isCpu) {
    xDirection = defaultDirection;
  }

  if (!input.left && !input.right && !input.up && !input.down) {
    return {
      x: defaultDirection * BALL_POWER_SPEED_X,
      y: -BALL_POWER_SPEED_Y,
    };
  }

  if ((input.up || input.down) && !input.left && !input.right) {
    return {
      x: xDirection * BALL_POWER_SPEED_Y,
      y: yDirection * BALL_POWER_SPEED_Y,
    };
  }

  if ((input.left || input.right) && !(input.up || input.down)) {
    return {
      x: xDirection * BALL_POWER_SPEED_X,
      y: 0,
    };
  }

  return {
    x: xDirection * BALL_POWER_SPEED_Y,
    y: yDirection * BALL_POWER_SPEED_Y,
  };
}
