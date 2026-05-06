import {
  Assets,
  AnimatedSprite,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  TextStyle,
  Texture,
} from 'pixi.js';
import { decompressFrames, parseGIF } from 'gifuct-js';
import type { AssetManifest } from '../assets/manifest';
import {
  BALL_RADIUS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  NET_HEIGHT,
  NET_TOP,
  NET_WIDTH,
  NET_X,
  PLAYER_RADIUS_X,
  PLAYER_RADIUS_Y,
} from './constants';
import type { Ball, HitboxDebugFrame, Player } from './types';

export class GameRenderer {
  readonly stage = new Container();

  private readonly court = new Graphics();
  private readonly net = new Graphics();
  private readonly playerShape = new Graphics();
  private readonly cpuShape = new Graphics();
  private readonly ballShape = new Graphics();
  private readonly powerTrailShape = new Graphics();
  private readonly shadowShape = new Graphics();
  private readonly debugShape = new Graphics();
  private readonly serveText = new Text({
    text: '',
    style: new TextStyle({
      fill: '#244152',
      fontFamily: 'Arial, sans-serif',
      fontSize: 12,
      fontWeight: '700',
    }),
  });
  private courtSprite: Sprite | null = null;
  private netSprite: Sprite | null = null;
  private ballSprite: Sprite | null = null;
  private readonly ballTrailSprites: Sprite[] = [];
  private playerSprite: AnimatedSprite | null = null;
  private cpuSprite: AnimatedSprite | null = null;
  private playerIdleTextures: Texture[] = [];
  private readonly ballHistory: Array<{ x: number; y: number; rotation: number }> = [];
  private frameCounter = 0;

  constructor() {
    this.stage.addChild(this.court);
    this.stage.addChild(this.net);
    this.stage.addChild(this.shadowShape);
    this.stage.addChild(this.playerShape);
    this.stage.addChild(this.cpuShape);
    this.stage.addChild(this.powerTrailShape);
    this.stage.addChild(this.ballShape);
    this.stage.addChild(this.serveText);
    this.stage.addChild(this.debugShape);
    this.drawCourt();
  }

  async loadAssets(manifest: AssetManifest): Promise<void> {
    const [courtTexture, netTexture, ballTexture, playerGifTextures, playerSheetTexture] = await Promise.all([
      loadTexture(manifest.court),
      loadTexture(manifest.net),
      loadTexture(manifest.ball),
      loadGifTextures(manifest.playerIdleGif),
      loadTexture(manifest.playerIdleSheet),
    ]);

    if (courtTexture) {
      this.courtSprite = new Sprite(courtTexture);
      this.stage.addChildAt(this.courtSprite, 0);
      fitSpriteCover(this.courtSprite, GAME_WIDTH, GAME_HEIGHT);
    }

    if (netTexture) {
      this.netSprite = new Sprite(netTexture);
      this.netSprite.anchor.set(0.5, 1);
      this.netSprite.x = NET_X;
      this.netSprite.y = GROUND_Y;
      const netScale = NET_HEIGHT / Math.max(1, netTexture.height);
      this.netSprite.scale.set(netScale);
      this.stage.addChild(this.netSprite);
    }

    if (playerGifTextures.length > 0 || playerSheetTexture) {
      this.playerIdleTextures =
        playerGifTextures.length > 0
          ? playerGifTextures
          : createFrames(playerSheetTexture as Texture, 64, 64, 8);
      this.playerSprite = new AnimatedSprite(this.playerIdleTextures);
      this.cpuSprite = new AnimatedSprite(this.playerIdleTextures);
      this.playerSprite.anchor.set(0.5, 1);
      this.cpuSprite.anchor.set(0.5, 1);
      this.playerSprite.animationSpeed = 1 / 16;
      this.cpuSprite.animationSpeed = 1 / 16;
      this.playerSprite.play();
      this.cpuSprite.play();
      this.stage.addChild(this.playerSprite);
      this.stage.addChild(this.cpuSprite);
    }

    if (ballTexture) {
      for (let index = 0; index < 4; index += 1) {
        const trailSprite = new Sprite(ballTexture);
        trailSprite.anchor.set(0.5);
        trailSprite.visible = false;
        this.ballTrailSprites.push(trailSprite);
        this.stage.addChild(trailSprite);
      }

      this.ballSprite = new Sprite(ballTexture);
      this.ballSprite.anchor.set(0.5);
      this.stage.addChild(this.ballSprite);
    }
  }

  render(
    player: Player,
    cpu: Player,
    ball: Ball,
    stateLabel: string,
    debugFrame: HitboxDebugFrame | null = null
  ): void {
    this.frameCounter += 1;
    this.drawCourt();
    this.drawNet();
    this.drawShadows(player, cpu, ball);
    this.drawPlayer(this.playerShape, player);
    this.drawPlayer(this.cpuShape, cpu);
    this.recordBallHistory(ball);
    this.drawPowerTrail(ball, player.hitCooldown > 10 || cpu.hitCooldown > 10);
    this.drawBall(ball);
    this.serveText.text = stateLabel;
    this.serveText.x = GAME_WIDTH / 2 - this.serveText.width / 2;
    this.serveText.y = 12;
    this.drawHitboxDebug(debugFrame);
  }

  private drawCourt(): void {
    this.court.clear();
    if (this.courtSprite) {
      return;
    }

    this.court.rect(0, 0, GAME_WIDTH, GAME_HEIGHT).fill(0x90d4df);
    this.court.rect(0, 0, GAME_WIDTH, 118).fill(0xa9e1ec);
    this.court.circle(72, 42, 18).fill(0xffd46b);
    this.court.rect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y).fill(0xe6c46d);
    this.court.rect(0, GROUND_Y, GAME_WIDTH, 5).fill(0xf6e2a2);
  }

  private drawNet(): void {
    this.net.clear();
    if (this.netSprite) {
      return;
    }

    this.net.rect(NET_X - NET_WIDTH / 2, NET_TOP, NET_WIDTH, NET_HEIGHT).fill(0x31404c);
    this.net
      .circle(NET_X, NET_TOP + 5, NET_WIDTH / 2 + 1)
      .fill(0xf4f0d7)
      .stroke({ color: 0x31404c, width: 1 });
  }

  private drawShadows(player: Player, cpu: Player, ball: Ball): void {
    this.shadowShape.clear();
    this.shadowShape
      .ellipse(player.x, GROUND_Y + 3, PLAYER_RADIUS_X * 0.95, 5)
      .fill({ color: 0x6b5e44, alpha: 0.26 });
    this.shadowShape
      .ellipse(cpu.x, GROUND_Y + 3, PLAYER_RADIUS_X * 0.95, 5)
      .fill({ color: 0x6b5e44, alpha: 0.26 });
    this.shadowShape
      .ellipse(ball.x, GROUND_Y + 2, Math.max(5, BALL_RADIUS - ball.y * 0.015), 3)
      .fill({ color: 0x6b5e44, alpha: 0.2 });
  }

  private drawPlayer(shape: Graphics, player: Player): void {
    const sprite = player.side === 'left' ? this.playerSprite : this.cpuSprite;
    if (sprite && this.playerIdleTextures.length > 0) {
      shape.visible = false;
      this.drawPlayerSprite(sprite, player);
      return;
    }

    shape.visible = true;
    const eyeOffset = player.facing * 6;
    shape.clear();
    shape.ellipse(player.x, player.y, PLAYER_RADIUS_X, PLAYER_RADIUS_Y).fill(player.color);
    shape.circle(player.x - 10, player.y - 22, 7).fill(player.color);
    shape.circle(player.x + 10, player.y - 22, 7).fill(player.color);
    shape.circle(player.x + eyeOffset - 5, player.y - 6, 3).fill(0x17212b);
    shape.circle(player.x + eyeOffset + 7, player.y - 6, 3).fill(0x17212b);
    shape.ellipse(player.x + player.facing * 10, player.y + 8, 8, 4).fill(player.accent);
    shape.circle(player.x - 13, player.y + 7, 5).fill(0xffe1da);
    shape.circle(player.x + 13, player.y + 7, 5).fill(0xffe1da);

    if (player.hitCooldown > 0) {
      shape
        .circle(player.x + player.facing * 28, player.y - 8, 6)
        .fill({ color: 0xffffff, alpha: 0.62 });
    }
  }

  private drawBall(ball: Ball): void {
    if (!ball.visible) {
      this.ballShape.clear();
      this.ballShape.visible = false;
      if (this.ballSprite) {
        this.ballSprite.visible = false;
      }
      return;
    }

    if (this.ballSprite) {
      this.ballShape.visible = false;
      this.ballSprite.visible = true;
      this.ballSprite.x = ball.x;
      this.ballSprite.y = ball.y;
      this.ballSprite.width = BALL_RADIUS * 2;
      this.ballSprite.height = BALL_RADIUS * 2;
      this.ballSprite.rotation += 0.04 * Math.sign(ball.vx || 1);
      return;
    }

    this.ballShape.visible = true;
    this.ballShape.clear();
    this.ballShape.circle(ball.x, ball.y, ball.radius).fill(0xfff4f0);
    this.ballShape.circle(ball.x - 4, ball.y - 4, ball.radius * 0.38).fill(0x49a6d8);
    this.ballShape
      .circle(ball.x, ball.y, ball.radius)
      .stroke({ color: 0x1d4a66, width: 2, alpha: 0.8 });
  }

  private drawPowerTrail(ball: Ball, active: boolean): void {
    this.powerTrailShape.clear();
    this.ballTrailSprites.forEach((sprite) => {
      sprite.visible = false;
    });
    if (!active || !ball.visible) {
      return;
    }

    const historyIndexes = [2, 4, 6, 8];
    for (let index = 0; index < historyIndexes.length; index += 1) {
      const history = this.ballHistory[historyIndexes[index]];
      if (!history) {
        continue;
      }

      const alpha = 0.36 - index * 0.07;
      const scale = 1 - index * 0.07;
      const sprite = this.ballTrailSprites[index];
      if (sprite) {
        sprite.visible = true;
        sprite.x = history.x;
        sprite.y = history.y;
        sprite.width = BALL_RADIUS * 2 * scale;
        sprite.height = BALL_RADIUS * 2 * scale;
        sprite.rotation = history.rotation;
        sprite.alpha = alpha;
        continue;
      }

      this.powerTrailShape
        .circle(history.x, history.y, BALL_RADIUS * scale)
        .fill({ color: 0xffffff, alpha });
    }
  }

  setPaused(paused: boolean): void {
    if (paused) {
      this.playerSprite?.stop();
      this.cpuSprite?.stop();
    } else {
      this.playerSprite?.play();
      this.cpuSprite?.play();
    }
  }

  private drawPlayerSprite(sprite: Sprite, player: Player): void {
    const bob = Math.sin(this.frameCounter / 10) * 1.2;
    const isHitting = player.hitCooldown > 0;
    const isJumping = !player.onGround && player.vy < -0.4;
    const isFalling = !player.onGround && player.vy >= -0.4;
    const direction = player.side === 'left' ? 1 : -1;
    const baseScale = 64 / Math.max(sprite.texture.width || 64, sprite.texture.height || 64);
    const actionScaleX = isHitting ? 1.08 : isFalling ? 1.1 : isJumping ? 0.94 : 1;
    const actionScaleY = isHitting ? 0.96 : isFalling ? 0.9 : isJumping ? 1.08 : 1;

    sprite.visible = true;
    sprite.x = player.x;
    sprite.y = player.y + PLAYER_RADIUS_Y + 4 + (player.onGround ? bob : 0);
    sprite.scale.set(direction * baseScale * actionScaleX, baseScale * actionScaleY);
    sprite.rotation = isHitting ? direction * 0.08 : isJumping ? direction * -0.04 : isFalling ? direction * 0.04 : 0;
  }

  private recordBallHistory(ball: Ball): void {
    if (!ball.visible) {
      this.ballHistory.length = 0;
      return;
    }

    this.ballHistory.unshift({
      x: ball.x,
      y: ball.y,
      rotation: this.ballSprite?.rotation ?? 0,
    });

    if (this.ballHistory.length > 14) {
      this.ballHistory.length = 14;
    }
  }

  private drawHitboxDebug(debugFrame: HitboxDebugFrame | null): void {
    this.debugShape.clear();

    if (!debugFrame?.enabled) {
      return;
    }

    for (const pixel of debugFrame.netMaskPixels) {
      this.debugShape
        .rect(pixel.x, pixel.y, pixel.size, pixel.size)
        .fill({ color: 0x15d47a, alpha: 0.2 });
    }

    const fallback = debugFrame.fallbackNet;
    this.debugShape
      .moveTo(fallback.x, fallback.top)
      .lineTo(fallback.x, fallback.bottom)
      .stroke({ color: 0xffd447, width: fallback.radius * 2, alpha: 0.38 });
    this.debugShape
      .circle(fallback.x, fallback.top, fallback.radius)
      .stroke({ color: 0xffd447, width: 1.5, alpha: 0.7 });
    this.debugShape
      .circle(debugFrame.ball.x, debugFrame.ball.y, debugFrame.ball.radius)
      .stroke({ color: 0x31a8ff, width: 1.6, alpha: 0.9 });

    if (!debugFrame.collision) {
      return;
    }

    const collision = debugFrame.collision;
    const normalLength = 24;
    this.debugShape
      .circle(collision.pointX, collision.pointY, 3.6)
      .fill({ color: collision.source === 'alpha' ? 0xff4b5c : 0xffd447, alpha: 0.95 });
    this.debugShape
      .moveTo(collision.pointX, collision.pointY)
      .lineTo(
        collision.pointX + collision.normalX * normalLength,
        collision.pointY + collision.normalY * normalLength
      )
      .stroke({ color: 0xff4b5c, width: 2.2, alpha: 0.95 });
  }
}

async function loadTexture(path: string): Promise<Texture | null> {
  if (!path) {
    return null;
  }

  try {
    return await Assets.load<Texture>(path);
  } catch {
    return null;
  }
}

function createFrames(texture: Texture, width: number, height: number, count: number): Texture[] {
  const frames: Texture[] = [];

  for (let index = 0; index < count; index += 1) {
    frames.push(
      new Texture({
        source: texture.source,
        frame: new Rectangle(index * width, 0, width, height),
      })
    );
  }

  return frames;
}

async function loadGifTextures(path: string): Promise<Texture[]> {
  if (!path) {
    return [];
  }

  try {
    const response = await fetch(path);
    if (!response.ok) {
      return [];
    }

    const buffer = await response.arrayBuffer();
    const gif = parseGIF(buffer);
    const frames = decompressFrames(gif, true);
    const width =
      gif.lsd?.width ??
      Math.max(...frames.map((frame) => frame.dims.left + frame.dims.width), 64);
    const height =
      gif.lsd?.height ??
      Math.max(...frames.map((frame) => frame.dims.top + frame.dims.height), 64);
    const workCanvas = document.createElement('canvas');
    workCanvas.width = width;
    workCanvas.height = height;
    const workContext = workCanvas.getContext('2d');

    if (!workContext) {
      return [];
    }

    return frames.map((frame) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const outputContext = canvas.getContext('2d');
      if (!outputContext) {
        return Texture.EMPTY;
      }

      const imageData = workContext.createImageData(frame.dims.width, frame.dims.height);
      imageData.data.set(frame.patch);
      workContext.putImageData(imageData, frame.dims.left, frame.dims.top);
      outputContext.drawImage(workCanvas, 0, 0);

      if (frame.disposalType === 2) {
        workContext.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
      }

      return Texture.from(canvas);
    });
  } catch {
    return [];
  }
}

function fitSpriteCover(sprite: Sprite, width: number, height: number): void {
  const textureWidth = sprite.texture.width || width;
  const textureHeight = sprite.texture.height || height;
  const scale = Math.max(width / textureWidth, height / textureHeight);
  sprite.scale.set(scale);
  sprite.x = (width - textureWidth * scale) / 2;
  sprite.y = (height - textureHeight * scale) / 2;
}
