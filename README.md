# Pipi Volleyball

一個原創的瀏覽器排球小遊戲雛形，玩法參考「左右隔網擊球、球落地得分」的經典模式，但程式與素材都重新製作。

## Play

```bash
npm install
npm run dev
```

開啟本機網址後按「開始」遊玩。

## Controls

- `A` / `D`：左右移動
- `W`：跳躍
- `S`：空中快速落下
- `J`：擊球
- `Space`：暫停 / 繼續
- `Enter`：每回合叫球從落後方半場上方落下

第一版是玩家在左側、電腦在右側，先拿到 5 分獲勝。

## Asset Replacement

素材入口定義在 `src/assets/manifest.ts`：

```ts
export type AssetManifest = {
  player: string;
  cpu: string;
  ball: string;
  court: string;
  bgm: string;
  hitSfx: string;
  scoreSfx: string;
};
```

目前使用程式繪製的臨時角色、球與場景，以及 Web Audio 產生的臨時音效。下一步可以把 `manifest` 改成實際檔案路徑，例如：

- `src/assets/player.png`
- `src/assets/cpu.png`
- `src/assets/ball.png`
- `src/assets/court.png`
- `src/assets/bgm.mp3`
- `src/assets/hit.wav`
- `src/assets/score.wav`

建議第一批正式素材尺寸：

- 角色：`64x64` PNG，透明背景
- 球：`32x32` PNG，透明背景
- 場景：`432x304` PNG
- 音效：短 WAV 或 MP3，擊球小於 0.3 秒，得分小於 1 秒

## Notes

參考遊戲的公開專案標示為 `UNLICENSED`，因此本專案不複製原始程式碼、角色、圖像、音樂或音效，只重新實作第一版近似玩法。

## Current Asset Paths

遊戲目前會優先讀取以下正式素材路徑；找不到時會回到臨時繪製素材：

- `public/assets/images/characters/player-idle-sheet.png`
- `public/assets/images/characters/player-idle-transparent.gif`
- `public/assets/images/ball/ball.png`
- `public/assets/images/court/court.png`
- `public/assets/images/net/net.png`
- `public/assets/audio/bgm/bgm.mp3`
- `public/assets/audio/sfx/hit.mp3`
- `public/assets/audio/sfx/score.wav`

目前必要素材是角色待機 GIF、球、場景。電腦角色會先鏡像玩家，網柱找不到時可由程式繪製，音效可以後補。

SUNO 生成的音樂音效請下載後放到固定路徑，遊戲不會在瀏覽器端呼叫 SUNO API：

- `public/assets/audio/bgm/bgm.mp3`
- `public/assets/audio/sfx/hit.wav`
- `public/assets/audio/sfx/score.wav`
