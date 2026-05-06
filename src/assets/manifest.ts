export type AssetManifest = {
  player: string;
  playerIdleSheet: string;
  playerIdleGif: string;
  cpu: string;
  ball: string;
  court: string;
  net: string;
  bgm: string;
  hitSfx: string;
  scoreSfx: string;
};

export const assetManifest: AssetManifest = {
  player: './assets/images/characters/player.png',
  playerIdleSheet: './assets/images/characters/player-idle-sheet.png',
  playerIdleGif: './assets/images/characters/player-idle-transparent.gif',
  cpu: './assets/images/characters/cpu.png',
  ball: './assets/images/ball/ball.png',
  court: './assets/images/court/court.png',
  net: './assets/images/net/net.png',
  bgm: './assets/audio/bgm/bgm.mp3',
  hitSfx: './assets/audio/sfx/hit.mp3',
  scoreSfx: './assets/audio/sfx/score.wav',
};
