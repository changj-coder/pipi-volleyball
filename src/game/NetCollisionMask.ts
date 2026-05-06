import {
  BALL_RADIUS,
  GROUND_Y,
  NET_COLLISION_RADIUS,
  NET_HEIGHT,
  NET_TOP,
  NET_X,
} from './constants';
import type { Ball, NetCollision, NetMaskDebugPixel } from './types';

const ALPHA_THRESHOLD = 32;
const MASK_PADDING = 0;
const DEBUG_PIXEL_STRIDE = 2;

export class NetCollisionMask {
  private readonly scale: number;
  private readonly worldLeft: number;
  private readonly worldTop: number;
  private readonly alpha: Uint8ClampedArray;
  private debugPixels: NetMaskDebugPixel[] | null = null;

  private constructor(
    private readonly width: number,
    private readonly height: number,
    imageData: ImageData
  ) {
    this.scale = NET_HEIGHT / Math.max(1, height);
    this.worldLeft = NET_X - (width * this.scale) / 2;
    this.worldTop = GROUND_Y - height * this.scale;
    this.alpha = imageData.data.filter((_, index) => index % 4 === 3);
  }

  static async fromImage(path: string): Promise<NetCollisionMask | null> {
    try {
      const image = await loadImage(path);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });

      if (!context || canvas.width <= 0 || canvas.height <= 0) {
        return null;
      }

      context.drawImage(image, 0, 0);
      return new NetCollisionMask(
        canvas.width,
        canvas.height,
        context.getImageData(0, 0, canvas.width, canvas.height)
      );
    } catch {
      return null;
    }
  }

  collideCircle(ball: Ball): NetCollision | null {
    if (!ball.visible) {
      return null;
    }

    const localCenterX = (ball.x - this.worldLeft) / this.scale;
    const localCenterY = (ball.y - this.worldTop) / this.scale;
    const localRadius = (ball.radius + MASK_PADDING) / this.scale;
    const minX = Math.max(0, Math.floor(localCenterX - localRadius));
    const maxX = Math.min(this.width - 1, Math.ceil(localCenterX + localRadius));
    const minY = Math.max(0, Math.floor(localCenterY - localRadius));
    const maxY = Math.min(this.height - 1, Math.ceil(localCenterY + localRadius));

    if (minX > maxX || minY > maxY) {
      return null;
    }

    let normalX = 0;
    let normalY = 0;
    let pointX = 0;
    let pointY = 0;
    let totalWeight = 0;
    let maxPenetration = 0;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (!this.isSolid(x, y)) {
          continue;
        }

        const pixelWorldX = this.worldLeft + (x + 0.5) * this.scale;
        const pixelWorldY = this.worldTop + (y + 0.5) * this.scale;
        const dx = ball.x - pixelWorldX;
        const dy = ball.y - pixelWorldY;
        const distance = Math.hypot(dx, dy);
        const penetration = ball.radius + MASK_PADDING - distance;

        if (penetration < 0) {
          continue;
        }

        const safeDistance = distance || 1;
        const weight = Math.max(0.01, penetration);
        normalX += (dx / safeDistance) * weight;
        normalY += (dy / safeDistance) * weight;
        pointX += pixelWorldX * weight;
        pointY += pixelWorldY * weight;
        totalWeight += weight;
        maxPenetration = Math.max(maxPenetration, penetration);
      }
    }

    if (totalWeight <= 0) {
      return null;
    }

    const normalLength = Math.hypot(normalX, normalY) || 1;

    return {
      pointX: pointX / totalWeight,
      pointY: pointY / totalWeight,
      normalX: normalX / normalLength,
      normalY: normalY / normalLength,
      penetration: maxPenetration,
      source: 'alpha',
    };
  }

  getDebugPixels(): NetMaskDebugPixel[] {
    if (this.debugPixels) {
      return this.debugPixels;
    }

    const pixels: NetMaskDebugPixel[] = [];
    for (let y = 0; y < this.height; y += DEBUG_PIXEL_STRIDE) {
      for (let x = 0; x < this.width; x += DEBUG_PIXEL_STRIDE) {
        if (!this.hasSolidPixelInBlock(x, y, DEBUG_PIXEL_STRIDE)) {
          continue;
        }

        pixels.push({
          x: this.worldLeft + x * this.scale,
          y: this.worldTop + y * this.scale,
          size: Math.max(0.7, this.scale * DEBUG_PIXEL_STRIDE),
        });
      }
    }

    this.debugPixels = pixels;
    return pixels;
  }

  getFallbackDebug(): { x: number; top: number; bottom: number; radius: number } {
    return {
      x: NET_X,
      top: NET_TOP,
      bottom: GROUND_Y,
      radius: NET_COLLISION_RADIUS,
    };
  }

  private isSolid(x: number, y: number): boolean {
    return this.alpha[y * this.width + x] > ALPHA_THRESHOLD;
  }

  private hasSolidPixelInBlock(startX: number, startY: number, size: number): boolean {
    for (let y = startY; y < Math.min(this.height, startY + size); y += 1) {
      for (let x = startX; x < Math.min(this.width, startX + size); x += 1) {
        if (this.isSolid(x, y)) {
          return true;
        }
      }
    }

    return false;
  }
}

export function createFallbackNetCollision(ball: Ball): NetCollision | null {
  if (!ball.visible) {
    return null;
  }

  const closestY = clamp(ball.y, NET_TOP, GROUND_Y);
  const dx = ball.x - NET_X;
  const dy = ball.y - closestY;
  const distance = Math.hypot(dx, dy) || 1;
  const minimumDistance = BALL_RADIUS + NET_COLLISION_RADIUS;

  if (distance >= minimumDistance) {
    return null;
  }

  return {
    pointX: NET_X,
    pointY: closestY,
    normalX: dx / distance,
    normalY: dy / distance,
    penetration: minimumDistance - distance,
    source: 'fallback',
  };
}

export function createFallbackNetDebug(): { x: number; top: number; bottom: number; radius: number } {
  return {
    x: NET_X,
    top: NET_TOP,
    bottom: GROUND_Y,
    radius: NET_COLLISION_RADIUS,
  };
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${path}`));
    image.src = path;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
