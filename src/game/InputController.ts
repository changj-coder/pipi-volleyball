import type { InputAction, InputBindings, InputState } from './types';

const INPUT_ACTIONS: InputAction[] = ['left', 'right', 'up', 'down', 'hit', 'serve'];

export const DEFAULT_KEY_BINDINGS: InputBindings = {
  left: 'KeyA',
  right: 'KeyD',
  up: 'KeyW',
  down: 'KeyS',
  hit: 'Space',
  serve: 'Enter',
};

export const ARROW_KEY_BINDINGS: InputBindings = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  hit: 'Space',
  serve: 'Enter',
};

export class InputController {
  readonly state: InputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    hit: false,
    serve: false,
  };

  private readonly keyboardState = createInputState();
  private readonly touchState = createInputState();
  private readonly keyMap = new Map<string, InputAction>();
  private bindings: InputBindings = { ...DEFAULT_KEY_BINDINGS };

  constructor(bindings: InputBindings = DEFAULT_KEY_BINDINGS) {
    this.setBindings(bindings);
  }

  attach(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  getBindings(): InputBindings {
    return { ...this.bindings };
  }

  setBindings(bindings: InputBindings): void {
    this.bindings = { ...bindings };
    this.keyMap.clear();

    for (const action of INPUT_ACTIONS) {
      this.keyMap.set(this.bindings[action], action);
    }

    this.clearKeyboardState();
    this.syncState();
  }

  setBinding(action: InputAction, code: string): void {
    const nextBindings = { ...this.bindings };

    for (const existingAction of INPUT_ACTIONS) {
      if (nextBindings[existingAction] === code) {
        nextBindings[existingAction] = '';
      }
    }

    nextBindings[action] = code;
    this.setBindings(nextBindings);
  }

  setTouchDirection(x: number, y: number): void {
    const threshold = 0.34;
    this.touchState.left = x < -threshold;
    this.touchState.right = x > threshold;
    this.touchState.up = y < -threshold;
    this.touchState.down = y > threshold;
    this.syncState();
  }

  clearTouchDirection(): void {
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.up = false;
    this.touchState.down = false;
    this.syncState();
  }

  setTouchHit(pressed: boolean): void {
    this.touchState.hit = pressed;
    this.touchState.serve = pressed;
    this.syncState();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const input = this.keyMap.get(event.code);
    if (!input) {
      return;
    }

    event.preventDefault();
    this.keyboardState[input] = true;
    this.syncState();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const input = this.keyMap.get(event.code);
    if (!input) {
      return;
    }

    event.preventDefault();
    this.keyboardState[input] = false;
    this.syncState();
  };

  private clearKeyboardState(): void {
    for (const action of INPUT_ACTIONS) {
      this.keyboardState[action] = false;
    }
  }

  private syncState(): void {
    for (const action of INPUT_ACTIONS) {
      this.state[action] = this.keyboardState[action] || this.touchState[action];
    }
  }
}

export function formatKeyLabel(code: string): string {
  if (!code) {
    return '-';
  }

  if (code.startsWith('Key')) {
    return code.slice(3);
  }

  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  if (code.startsWith('Arrow')) {
    return code.replace('Arrow', '');
  }

  if (code === 'Space') {
    return 'Space';
  }

  return code;
}

function createInputState(): InputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    hit: false,
    serve: false,
  };
}
