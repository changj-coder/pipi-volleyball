import { Application } from 'pixi.js';
import { assetManifest } from '../assets/manifest';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { AiController } from './AiController';
import { AudioManager } from './AudioManager';
import { GameModel } from './GameModel';
import { GameRenderer } from './GameRenderer';
import { InputController } from './InputController';

export class VolleyballGame {
  private readonly model = new GameModel();
  private readonly renderer = new GameRenderer();
  private readonly input = new InputController();
  private readonly ai = new AiController();
  private readonly audio = new AudioManager();
  private readonly shell = document.createElement('main');
  private readonly frame = document.createElement('section');
  private readonly message = document.createElement('div');
  private readonly startButton = document.createElement('button');
  private readonly resetButton = document.createElement('button');
  private readonly pauseButton = document.createElement('button');
  private readonly muteButton = document.createElement('button');
  private readonly pauseOverlay = document.createElement('div');
  private paused = false;

  private app: Application | null = null;

  constructor(private readonly root: HTMLElement) {}

  async start(): Promise<void> {
    this.buildUi();

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
    await Promise.all([
      this.renderer.loadAssets(assetManifest),
      this.audio.loadAssets(assetManifest),
    ]);
    this.app.stage.addChild(this.renderer.stage);
    this.input.attach();
    window.addEventListener('keydown', this.handleGlobalKeyDown);
    this.updateScore();
    this.renderer.render(this.model.player, this.model.cpu, this.model.ball, '');
    this.app.ticker.add(this.tick);
  }

  private buildUi(): void {
    this.shell.className = 'shell';
    this.shell.innerHTML = `
      <header class="topbar">
        <div class="brand">Pipi Volleyball</div>
        <div class="scoreboard" aria-label="比分">
          <span class="score-name">玩家</span>
          <span class="score-number" data-player-score>0</span>
          <span class="score-divider">:</span>
          <span class="score-number" data-cpu-score>0</span>
          <span class="score-name">電腦</span>
        </div>
        <div class="actions"></div>
      </header>
      <div class="game-wrap"></div>
      <footer class="controls">
        <span><span class="key">A</span>/<span class="key">D</span> 移動</span>
        <span><span class="key">W</span> 跳躍</span>
        <span><span class="key">S</span> 快速落下</span>
        <span><span class="key">J</span> 擊球</span>
        <span><span class="key">Enter</span> 叫球落下</span>
      </footer>
    `;

    const actions = this.shell.querySelector<HTMLDivElement>('.actions');
    const wrap = this.shell.querySelector<HTMLDivElement>('.game-wrap');
    const playerScore = this.shell.querySelector<HTMLSpanElement>('[data-player-score]');
    const cpuScore = this.shell.querySelector<HTMLSpanElement>('[data-cpu-score]');

    if (!actions || !wrap || !playerScore || !cpuScore) {
      throw new Error('Could not build game UI.');
    }

    this.startButton.className = 'primary-button';
    this.startButton.textContent = '開始';
    this.startButton.addEventListener('click', () => {
      this.setPaused(false);
      this.model.start();
      this.audio.playBgm();
      this.updateScore();
    });

    this.resetButton.className = 'icon-button';
    this.resetButton.type = 'button';
    this.resetButton.title = '重來';
    this.resetButton.textContent = '↻';
    this.resetButton.addEventListener('click', () => {
      this.setPaused(false);
      this.model.restart();
      this.audio.playBgm();
      this.updateScore();
    });

    this.pauseButton.className = 'icon-button';
    this.pauseButton.type = 'button';
    this.pauseButton.title = '暫停';
    this.pauseButton.textContent = 'Ⅱ';
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

    actions.append(this.startButton, this.resetButton, this.pauseButton, this.muteButton);

    this.frame.className = 'game-frame';
    this.frame.setAttribute('aria-label', '排球小遊戲畫面');
    this.message.className = 'message';
    this.message.textContent = this.model.roundMessage;
    this.pauseOverlay.className = 'pause-overlay';
    this.pauseOverlay.textContent = '暫停';
    this.frame.append(this.message);
    this.frame.append(this.pauseOverlay);
    wrap.append(this.frame);

    this.root.replaceChildren(this.shell);
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
    this.renderer.render(
      this.model.player,
      this.model.cpu,
      this.model.ball,
      ''
    );
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

  private readonly handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Space') {
      return;
    }

    event.preventDefault();
    this.togglePaused();
  };

  private togglePaused(): void {
    this.setPaused(!this.paused);
  }

  private setPaused(paused: boolean): void {
    this.paused = paused;
    this.renderer.setPaused(paused);
    this.pauseOverlay.classList.toggle('is-visible', paused);
    this.pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    this.pauseButton.title = paused ? '繼續' : '暫停';
  }
}
