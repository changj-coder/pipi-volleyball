import { Application } from 'pixi.js';
import { assetManifest } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { AiController } from './AiController';
import { AudioManager } from './AudioManager';
import { GameModel } from './GameModel';
import { GameRenderer } from './GameRenderer';
import { NetCollisionMask } from './NetCollisionMask';
import {
  ARROW_KEY_BINDINGS,
  DEFAULT_KEY_BINDINGS,
  formatKeyLabel,
  InputController,
} from './InputController';
import type { AiDifficulty, InputAction, InputBindings } from './types';

const KEY_BINDINGS_STORAGE_KEY = 'pipi-volleyball-key-bindings-v2';
const AI_DIFFICULTY_STORAGE_KEY = 'pipi-volleyball-ai-difficulty';
const INPUT_ACTIONS: InputAction[] = ['left', 'right', 'up', 'down', 'hit', 'serve'];
const INPUT_ACTION_LABELS: Record<InputAction, string> = {
  left: '左移',
  right: '右移',
  up: '跳躍 / 上擊',
  down: '落下 / 下擊',
  hit: '擊球',
  serve: '發球',
};

export class VolleyballGame {
  private readonly model = new GameModel();
  private readonly renderer = new GameRenderer();
  private readonly input = new InputController(loadKeyBindings());
  private readonly ai = new AiController();
  private readonly audio = new AudioManager();
  private readonly shell = document.createElement('main');
  private readonly frame = document.createElement('section');
  private readonly hud = document.createElement('div');
  private readonly message = document.createElement('div');
  private readonly menuOverlay = document.createElement('div');
  private readonly menuPanel = document.createElement('div');
  private readonly menuTitle = document.createElement('div');
  private readonly menuActions = document.createElement('div');
  private readonly startButton = document.createElement('button');
  private readonly resetButton = document.createElement('button');
  private readonly pauseButton = document.createElement('button');
  private readonly muteButton = document.createElement('button');
  private readonly settingsButton = document.createElement('button');
  private readonly hitboxDebugButton = document.createElement('button');
  private readonly keyBindingButtons = new Map<InputAction, HTMLButtonElement>();
  private readonly touchControls = document.createElement('div');
  private readonly touchStick = document.createElement('button');
  private readonly touchKnob = document.createElement('span');
  private readonly touchHitButton = document.createElement('button');
  private aiDifficulty: AiDifficulty = loadAiDifficulty();
  private settingsPanel: HTMLElement | null = null;
  private difficultySelect: HTMLSelectElement | null = null;
  private bindingCaptureAction: InputAction | null = null;
  private activeJoystickPointerId: number | null = null;
  private hitboxDebugEnabled = false;
  private paused = false;

  private app: Application | null = null;

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
    this.buildUi();
    this.ai.setDifficulty(this.aiDifficulty);

    this.app = new Application();
    await this.app.init({
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundAlpha: 0,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    this.frame.prepend(this.app.canvas);
    const [netCollisionMask] = await Promise.all([
      NetCollisionMask.fromImage(assetManifest.net),
      this.renderer.loadAssets(assetManifest),
      this.audio.loadAssets(assetManifest),
    ]);
    this.model.setNetCollisionMask(netCollisionMask);
    this.app.stage.addChild(this.renderer.stage);
    this.input.attach();
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    this.updateScore();
    this.renderFrame();
    this.syncMenuOverlay();
    this.app.ticker.add(this.tick);
  }

  private buildUi(): void {
    this.shell.className = 'shell';
    this.shell.innerHTML = `
      <div class="game-wrap"></div>
      <footer class="controls">
        <span><span class="key" data-key-label="left">A</span>/<span class="key" data-key-label="right">D</span> 移動</span>
        <span><span class="key" data-key-label="up">W</span> 跳躍 / 上擊</span>
        <span><span class="key" data-key-label="down">S</span> 快速落下 / 下擊</span>
        <span><span class="key" data-key-label="hit">Space</span> 擊球</span>
        <span><span class="key" data-key-label="serve">Enter</span> 發球</span>
        <span><span class="key">ESC</span> 暫停</span>
      </footer>
    `;

    const wrap = this.shell.querySelector<HTMLDivElement>('.game-wrap');
    if (!wrap) {
      throw new Error('Could not build game UI.');
    }

    this.buildButtons();
    this.frame.className = 'game-frame';
    this.frame.setAttribute('aria-label', '排球小遊戲畫面');
    this.buildHud();
    this.buildMenuOverlay();
    this.buildTouchControls();

    this.message.className = 'message';
    this.message.textContent = this.model.roundMessage;
    this.frame.append(this.hud, this.message, this.menuOverlay, this.touchControls);
    wrap.append(this.frame);
    this.root.replaceChildren(this.shell);
    this.refreshControlLabels();
  }

  private buildButtons(): void {
    this.startButton.className = 'primary-button';
    this.startButton.type = 'button';
    this.startButton.addEventListener('click', () => {
      this.setPaused(false);
      this.model.start();
      this.audio.playBgm();
      this.updateScore();
      this.syncMenuOverlay();
    });

    this.resetButton.className = 'secondary-button';
    this.resetButton.type = 'button';
    this.resetButton.textContent = '重來';
    this.resetButton.addEventListener('click', () => {
      this.setPaused(false);
      this.model.restart();
      this.audio.playBgm();
      this.updateScore();
      this.syncMenuOverlay();
    });

    this.pauseButton.className = 'secondary-button';
    this.pauseButton.type = 'button';
    this.pauseButton.addEventListener('click', () => this.togglePaused());

    this.muteButton.className = 'icon-button';
    this.muteButton.type = 'button';
    this.muteButton.title = '靜音';
    this.muteButton.textContent = '♪';
    this.muteButton.addEventListener('click', () => {
      const muted = this.audio.toggleMuted();
      this.muteButton.textContent = muted ? '×' : '♪';
      this.muteButton.title = muted ? '取消靜音' : '靜音';
    });

    this.settingsButton.className = 'icon-button';
    this.settingsButton.type = 'button';
    this.settingsButton.title = '設定';
    this.settingsButton.textContent = '⚙';
    this.settingsButton.addEventListener('click', () => {
      if (!this.settingsPanel) {
        return;
      }

      this.settingsPanel.hidden = !this.settingsPanel.hidden;
      this.settingsButton.classList.toggle('is-active', !this.settingsPanel.hidden);
    });

    this.hitboxDebugButton.className = 'secondary-button';
    this.hitboxDebugButton.type = 'button';
    this.hitboxDebugButton.addEventListener('click', () => {
      this.hitboxDebugEnabled = !this.hitboxDebugEnabled;
      this.hitboxDebugButton.classList.toggle('is-active', this.hitboxDebugEnabled);
      this.hitboxDebugButton.textContent = this.hitboxDebugEnabled ? 'Hitbox On' : 'Hitbox Off';
      this.renderFrame();
    });
    this.hitboxDebugButton.textContent = 'Hitbox Off';
  }

  private buildHud(): void {
    this.hud.className = 'game-hud';
    this.hud.innerHTML = `
      <div class="scoreboard" aria-label="比分">
        <span class="score-name">玩家</span>
        <span class="score-number" data-player-score>0</span>
        <span class="score-divider">:</span>
        <span class="score-number" data-cpu-score>0</span>
        <span class="score-name">電腦</span>
      </div>
    `;
  }

  private buildMenuOverlay(): void {
    this.menuOverlay.className = 'menu-overlay';
    this.menuPanel.className = 'menu-panel';
    this.menuTitle.className = 'menu-title';
    this.menuActions.className = 'menu-actions';
    this.menuActions.append(
      this.startButton,
      this.resetButton,
      this.pauseButton,
      this.muteButton,
      this.settingsButton,
      this.hitboxDebugButton
    );

    this.settingsPanel = document.createElement('section');
    this.settingsPanel.className = 'settings-panel';
    this.settingsPanel.hidden = true;
    this.settingsPanel.innerHTML = `
      <div class="settings-group">
        <div class="settings-title">按鍵</div>
        <div class="key-grid" data-key-grid></div>
        <div class="preset-row">
          <button class="secondary-button" type="button" data-preset="wasd">WASD</button>
          <button class="secondary-button" type="button" data-preset="arrows">方向鍵</button>
        </div>
      </div>
      <div class="settings-group">
        <label class="settings-title" for="ai-difficulty">AI 強度</label>
        <select class="select-control" id="ai-difficulty" data-ai-difficulty>
          <option value="easy">簡單 25%</option>
          <option value="normal">普通 50%</option>
          <option value="hard">困難 100%</option>
        </select>
      </div>
    `;

    const keyGrid = this.settingsPanel.querySelector<HTMLDivElement>('[data-key-grid]');
    this.difficultySelect = this.settingsPanel.querySelector<HTMLSelectElement>('[data-ai-difficulty]');
    if (!keyGrid || !this.difficultySelect) {
      throw new Error('Could not build settings UI.');
    }

    this.buildKeyBindingControls(keyGrid);
    this.bindSettingsControls();
    this.menuPanel.append(this.menuTitle, this.menuActions, this.settingsPanel);
    this.menuOverlay.append(this.menuPanel);
  }

  private readonly tick = (): void => {
    if (this.paused) {
      return;
    }

    const cpuInput = this.ai.decide(this.model.cpu, this.model.ball);
    const result = this.model.tick(this.input.state, cpuInput);

    if (result.hit) {
      this.audio.playHit();
    }

    if (result.scoredBy) {
      this.audio.playScore();
      this.updateScore();
    }

    this.message.textContent = this.model.roundMessage;
    this.renderFrame();

    if (result.gameOver) {
      this.syncMenuOverlay();
    }
  };

  private updateScore(): void {
    const playerScore = this.shell.querySelector<HTMLSpanElement>('[data-player-score]');
    const cpuScore = this.shell.querySelector<HTMLSpanElement>('[data-cpu-score]');

    if (playerScore) {
      playerScore.textContent = String(this.model.score.player);
    }

    if (cpuScore) {
      cpuScore.textContent = String(this.model.score.cpu);
    }
  }

  private renderFrame(): void {
    this.renderer.render(
      this.model.player,
      this.model.cpu,
      this.model.ball,
      '',
      this.model.getHitboxDebugFrame(this.hitboxDebugEnabled)
    );
  }

  private readonly handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Escape') {
      return;
    }

    if (this.model.state === 'idle' || this.model.state === 'gameOver') {
      return;
    }

    event.preventDefault();
    this.togglePaused();
  };

  private togglePaused(): void {
    this.setPaused(!this.paused);
  }

  private setPaused(paused: boolean): void {
    this.paused = this.model.state === 'idle' || this.model.state === 'gameOver' ? false : paused;
    this.renderer.setPaused(this.paused);
    this.syncMenuOverlay();
  }

  private syncMenuOverlay(): void {
    const showMenu =
      this.paused || this.model.state === 'idle' || this.model.state === 'gameOver';
    const isGameOver = this.model.state === 'gameOver';

    this.menuOverlay.classList.toggle('is-visible', showMenu);
    this.message.hidden = showMenu;
    this.startButton.hidden = this.paused;
    this.startButton.textContent = isGameOver ? '再戰' : '開始';
    this.resetButton.hidden = this.model.state === 'idle';
    this.pauseButton.hidden = !this.paused;
    this.pauseButton.textContent = '繼續';
    this.menuTitle.textContent = this.paused
      ? '暫停'
      : isGameOver
        ? this.model.roundMessage
        : 'Pipi Volleyball';
  }

  private buildKeyBindingControls(keyGrid: HTMLElement): void {
    keyGrid.replaceChildren();
    this.keyBindingButtons.clear();

    for (const action of INPUT_ACTIONS) {
      const label = document.createElement('span');
      const button = document.createElement('button');
      label.className = 'key-bind-label';
      label.textContent = INPUT_ACTION_LABELS[action];
      button.className = 'key-bind-button';
      button.type = 'button';
      button.addEventListener('click', () => this.beginKeyBinding(action));
      this.keyBindingButtons.set(action, button);
      keyGrid.append(label, button);
    }
  }

  private bindSettingsControls(): void {
    this.difficultySelect?.addEventListener('change', () => {
      const difficulty = this.difficultySelect?.value as AiDifficulty;
      if (!isAiDifficulty(difficulty)) {
        return;
      }

      this.aiDifficulty = difficulty;
      this.ai.setDifficulty(difficulty);
      localStorage.setItem(AI_DIFFICULTY_STORAGE_KEY, difficulty);
    });

    if (this.difficultySelect) {
      this.difficultySelect.value = this.aiDifficulty;
    }

    this.settingsPanel?.querySelector<HTMLButtonElement>('[data-preset="wasd"]')?.addEventListener('click', () => {
      this.input.setBindings(DEFAULT_KEY_BINDINGS);
      this.saveKeyBindings();
      this.refreshControlLabels();
    });

    this.settingsPanel?.querySelector<HTMLButtonElement>('[data-preset="arrows"]')?.addEventListener('click', () => {
      this.input.setBindings(ARROW_KEY_BINDINGS);
      this.saveKeyBindings();
      this.refreshControlLabels();
    });
  }

  private beginKeyBinding(action: InputAction): void {
    window.removeEventListener('keydown', this.handleBindingKeyDown, true);
    this.bindingCaptureAction = action;
    this.refreshControlLabels();
    this.keyBindingButtons.get(action)!.textContent = '按鍵...';
    window.addEventListener('keydown', this.handleBindingKeyDown, true);
  }

  private readonly handleBindingKeyDown = (event: KeyboardEvent): void => {
    if (!this.bindingCaptureAction) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    const action = this.bindingCaptureAction;
    this.bindingCaptureAction = null;
    window.removeEventListener('keydown', this.handleBindingKeyDown, true);

    if (event.code !== 'Escape') {
      this.input.setBinding(action, event.code);
      this.saveKeyBindings();
    }

    this.refreshControlLabels();
  };

  private refreshControlLabels(): void {
    const bindings = this.input.getBindings();

    for (const action of INPUT_ACTIONS) {
      const label = formatKeyLabel(bindings[action]);
      const button = this.keyBindingButtons.get(action);
      if (button) {
        button.textContent = label;
        button.title = `設定${INPUT_ACTION_LABELS[action]}`;
      }

      this.shell
        .querySelectorAll<HTMLElement>(`[data-key-label="${action}"]`)
        .forEach((element) => {
          element.textContent = label;
        });
    }
  }

  private saveKeyBindings(): void {
    localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(this.input.getBindings()));
  }

  private buildTouchControls(): void {
    this.touchControls.className = 'touch-controls';
    this.touchStick.className = 'touch-stick';
    this.touchStick.type = 'button';
    this.touchStick.setAttribute('aria-label', '移動搖桿');
    this.touchKnob.className = 'touch-knob';
    this.touchStick.append(this.touchKnob);

    this.touchHitButton.className = 'touch-hit-button';
    this.touchHitButton.type = 'button';
    this.touchHitButton.textContent = '擊球';

    this.touchControls.append(this.touchStick, this.touchHitButton);

    this.touchStick.addEventListener('pointerdown', this.handleJoystickPointerDown);
    this.touchStick.addEventListener('pointermove', this.handleJoystickPointerMove);
    this.touchStick.addEventListener('pointerup', this.handleJoystickPointerUp);
    this.touchStick.addEventListener('pointercancel', this.handleJoystickPointerUp);
    this.touchHitButton.addEventListener('pointerdown', this.handleTouchHitDown);
    this.touchHitButton.addEventListener('pointerup', this.handleTouchHitUp);
    this.touchHitButton.addEventListener('pointercancel', this.handleTouchHitUp);
    this.touchHitButton.addEventListener('pointerleave', this.handleTouchHitUp);
    this.touchControls.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  private readonly handleJoystickPointerDown = (event: PointerEvent): void => {
    this.activeJoystickPointerId = event.pointerId;
    this.touchStick.setPointerCapture(event.pointerId);
    this.updateJoystick(event);
  };

  private readonly handleJoystickPointerMove = (event: PointerEvent): void => {
    if (this.activeJoystickPointerId !== event.pointerId) {
      return;
    }

    this.updateJoystick(event);
  };

  private readonly handleJoystickPointerUp = (event: PointerEvent): void => {
    if (this.activeJoystickPointerId !== event.pointerId) {
      return;
    }

    this.activeJoystickPointerId = null;
    this.input.clearTouchDirection();
    this.touchKnob.style.transform = 'translate(-50%, -50%)';
  };

  private updateJoystick(event: PointerEvent): void {
    event.preventDefault();
    const rect = this.touchStick.getBoundingClientRect();
    const maxDistance = Math.max(24, Math.min(rect.width, rect.height) * 0.34);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > maxDistance ? maxDistance / distance : 1;
    const knobX = dx * scale;
    const knobY = dy * scale;
    this.touchKnob.style.transform = `translate(-50%, -50%) translate(${knobX}px, ${knobY}px)`;
    this.input.setTouchDirection(knobX / maxDistance, knobY / maxDistance);
  }

  private readonly handleTouchHitDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.touchHitButton.setPointerCapture(event.pointerId);
    this.input.setTouchHit(true);
  };

  private readonly handleTouchHitUp = (event: PointerEvent): void => {
    event.preventDefault();
    this.input.setTouchHit(false);
  };
}

function loadKeyBindings(): InputBindings {
  try {
    const stored = localStorage.getItem(KEY_BINDINGS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_KEY_BINDINGS;
    }

    const parsed = JSON.parse(stored) as Partial<InputBindings>;
    const bindings = { ...DEFAULT_KEY_BINDINGS };
    for (const action of INPUT_ACTIONS) {
      if (typeof parsed[action] === 'string') {
        bindings[action] = parsed[action];
      }
    }

    return bindings;
  } catch {
    return DEFAULT_KEY_BINDINGS;
  }
}

function loadAiDifficulty(): AiDifficulty {
  const stored = localStorage.getItem(AI_DIFFICULTY_STORAGE_KEY);
  return isAiDifficulty(stored) ? stored : 'hard';
}

function isAiDifficulty(value: unknown): value is AiDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}
