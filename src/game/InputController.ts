import type { InputState } from './types';

export class InputController {
  readonly state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    hit: false,
    serve: false,
  };

  private readonly keyMap = new Map<string, keyof InputState>([
    ['KeyA', 'left'],
    ['ArrowLeft', 'left'],
    ['KeyD', 'right'],
    ['ArrowRight', 'right'],
    ['KeyW', 'up'],
    ['ArrowUp', 'up'],
    ['KeyS', 'down'],
    ['ArrowDown', 'down'],
    ['KeyJ', 'hit'],
    ['Enter', 'serve'],
  ]);

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const input = this.keyMap.get(event.code);
    if (!input) {
      return;
    }

    event.preventDefault();
    this.state[input] = true;
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const input = this.keyMap.get(event.code);
    if (!input) {
      return;
    }

    event.preventDefault();
    this.state[input] = false;
  };
}
