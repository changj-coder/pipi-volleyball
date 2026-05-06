from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    Image = None


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GENERATED_ROOT = Path.home() / ".codex" / "generated_images"
DEFAULT_SHEET_OUTPUT = (
    PROJECT_ROOT / "public" / "assets" / "images" / "characters" / "player-idle-sheet.png"
)
DEFAULT_GIF_OUTPUT = PROJECT_ROOT / "exports" / "gifs" / "player-idle.gif"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create the player idle GIF from an 8-frame 512x64 sprite sheet."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Path to the generated 512x64 PNG sprite sheet. If omitted, public/assets/images/characters/player-idle-sheet.png is used first, then the latest PNG under ~/.codex/generated_images.",
    )
    parser.add_argument("--frame-width", type=int, default=64)
    parser.add_argument("--frame-height", type=int, default=64)
    parser.add_argument("--frames", type=int, default=8)
    parser.add_argument("--duration", type=int, default=120, help="Frame duration in ms.")
    args = parser.parse_args()

    if Image is None:
        print("Pillow is required. Install it with: python -m pip install pillow")
        return 1

    source = args.source or find_default_source()
    if not source or not source.exists():
        print("Could not find a generated sprite sheet PNG.")
        print("Pass it explicitly, for example:")
        print(r"py scripts\make_player_idle_gif.py --source C:\path\to\sheet.png")
        return 1

    sheet = Image.open(source).convert("RGBA")
    expected_width = args.frame_width * args.frames
    expected_height = args.frame_height

    if sheet.width < expected_width or sheet.height < expected_height:
        print(
            f"Source image is {sheet.width}x{sheet.height}, but expected at least "
            f"{expected_width}x{expected_height}."
        )
        return 1

    DEFAULT_SHEET_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_GIF_OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    if source.resolve() != DEFAULT_SHEET_OUTPUT.resolve():
        shutil.copy2(source, DEFAULT_SHEET_OUTPUT)

    frames = []
    for index in range(args.frames):
        left = index * args.frame_width
        frame = sheet.crop((left, 0, left + args.frame_width, args.frame_height))
        frames.append(to_transparent_gif_frame(frame))

    frames[0].save(
        DEFAULT_GIF_OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=args.duration,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )

    print(f"Copied sheet: {DEFAULT_SHEET_OUTPUT}")
    print(f"Created GIF:  {DEFAULT_GIF_OUTPUT}")
    return 0


def find_default_source() -> Path | None:
    if DEFAULT_SHEET_OUTPUT.exists():
        return DEFAULT_SHEET_OUTPUT

    return find_latest_generated_png()


def find_latest_generated_png() -> Path | None:
    if not DEFAULT_GENERATED_ROOT.exists():
        return None

    pngs = [
        path
        for path in DEFAULT_GENERATED_ROOT.rglob("*.png")
        if path.is_file() and not path.name.startswith(".")
    ]
    if not pngs:
        return None

    return max(pngs, key=lambda path: path.stat().st_mtime)


def to_transparent_gif_frame(frame: "Image.Image") -> "Image.Image":
    rgba = frame.convert("RGBA")
    alpha = rgba.getchannel("A")

    # GIF supports 1 transparent palette index, not full alpha.
    # Put fully transparent pixels at index 255 and quantize only visible pixels.
    matte = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    matte.alpha_composite(rgba)

    rgb = Image.new("RGB", rgba.size, (0, 0, 0))
    rgb.paste(matte.convert("RGB"), mask=alpha)
    paletted = rgb.quantize(colors=255, method=Image.Quantize.MEDIANCUT)

    data = bytearray(paletted.tobytes())
    alpha_data = alpha.tobytes()
    for index, value in enumerate(alpha_data):
        if value < 8:
            data[index] = 255

    transparent = Image.frombytes("P", rgba.size, bytes(data))
    palette = paletted.getpalette() or []
    palette += [0] * (768 - len(palette))
    palette[255 * 3 : 255 * 3 + 3] = [0, 0, 0]
    transparent.putpalette(palette)
    transparent.info["transparency"] = 255
    return transparent


if __name__ == "__main__":
    raise SystemExit(main())
