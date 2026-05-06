declare module 'gifuct-js' {
  export type GifFrame = {
    dims: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    delay: number;
    disposalType: number;
    patch: Uint8ClampedArray;
  };

  export type ParsedGif = {
    lsd?: {
      width?: number;
      height?: number;
    };
  };

  export function parseGIF(buffer: ArrayBuffer): ParsedGif;
  export function decompressFrames(gif: unknown, buildImagePatches: boolean): GifFrame[];
}
