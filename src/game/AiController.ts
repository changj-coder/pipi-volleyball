import {
  BALL_RADIUS,
  GROUND_Y,
  NET_X,
  PLAYER_GROUND_Y,
  PLAYER_RADIUS_X,
} from './constants';
import type { AiDifficulty, Ball, InputState, Player } from './types';

const AI_STRENGTH: Record<AiDifficulty, number> = {
  easy: 0.25,
  normal: 0.5,
  hard: 1,
};

export class AiController {
  private reactionFrames = 0;
  private targetOffset = 18;
  private hesitationFrames = 0;
  private difficulty: AiDifficulty = 'hard';

  setDifficulty(difficulty: AiDifficulty): void {
    this.difficulty = difficulty;
    this.reactionFrames = 0;
    this.hesitationFrames = 0;
  }

  decide(cpu: Player, ball: Ball): InputState {
    const strength = AI_STRENGTH[this.difficulty];
    const input: InputState = {
      left: false,
      right: false,
      up: false,
      down: false,
      hit: false,
      serve: false,
    };

    if (!ball.visible) {
      return input;
    }

    if (this.reactionFrames <= 0) {
      this.reactionFrames = Math.round((28 + Math.floor(Math.random() * 32)) / strength);
      this.targetOffset = (Math.random() - 0.5) * (112 / strength);
      this.hesitationFrames =
        Math.random() < Math.min(0.86, 0.38 / strength)
          ? Math.round((30 + Math.floor(Math.random() * 38)) / strength)
          : 0;
    } else {
      this.reactionFrames -= 1;
    }

    if (this.hesitationFrames > 0) {
      this.hesitationFrames -= 1;
    }

    const targetX = this.chooseTargetX(ball) + this.targetOffset;
    const deadZone = 12 / strength;

    if (cpu.x < targetX - deadZone) {
      input.right = true;
    } else if (cpu.x > targetX + deadZone) {
      input.left = true;
    }

    const ballIsNear =
      Math.abs(ball.x - cpu.x) < PLAYER_RADIUS_X + BALL_RADIUS + 28 &&
      Math.abs(ball.y - cpu.y) < 76;

    const isHesitating = this.hesitationFrames > 0;
    input.up = !isHesitating && ballIsNear && ball.y < cpu.y + 12 && ball.vy >= -3.5 && Math.random() > 0.36;
    input.hit = !isHesitating && ballIsNear && ball.x > NET_X - 32 && Math.random() > 0.44;
    input.down = ball.y > cpu.y + 34 && ball.x > NET_X;

    if (strength < 1) {
      input.left = input.left && Math.random() < strength;
      input.right = input.right && Math.random() < strength;
      input.up = input.up && Math.random() < strength;
      input.down = input.down && Math.random() < strength;
      input.hit = input.hit && Math.random() < strength;
    }

    return input;
  }

  private chooseTargetX(ball: Ball): number {
    if (ball.x < NET_X - 8 && ball.vx <= 0) {
      return NET_X + 42;
    }

    const landingX = this.predictLandingX(ball);
    const clampedLanding = Math.max(NET_X + 30, Math.min(400, landingX));

    if (ball.y < 112 && ball.vx > 0) {
      return clampedLanding - 18;
    }

    return clampedLanding;
  }

  private predictLandingX(ball: Ball): number {
    let x = ball.x;
    let y = ball.y;
    let vx = ball.vx;
    let vy = ball.vy;

    for (let frame = 0; frame < 160; frame += 1) {
      vy += 0.24;
      x += vx;
      y += vy;

      if (x < BALL_RADIUS) {
        x = BALL_RADIUS;
        vx = Math.abs(vx) * 0.78;
      }

      if (x > 432 - BALL_RADIUS) {
        x = 432 - BALL_RADIUS;
        vx = -Math.abs(vx) * 0.78;
      }

      if (y + BALL_RADIUS >= GROUND_Y || y >= PLAYER_GROUND_Y + 26) {
        break;
      }
    }

    return x;
  }
}
