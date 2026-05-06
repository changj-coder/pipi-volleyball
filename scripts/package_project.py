from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DIST_DIR = PROJECT_ROOT / "dist"
RELEASES_DIR = PROJECT_ROOT / "releases"
PACKAGE_NAME = "pipi-volleyball-web.zip"


def main() -> int:
    if not DIST_DIR.exists():
        print("dist folder does not exist. Run `npm run build` first.")
        return 1

    RELEASES_DIR.mkdir(parents=True, exist_ok=True)
    package_path = RELEASES_DIR / PACKAGE_NAME

    if package_path.exists():
        archive_dir = RELEASES_DIR / "archive"
        archive_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.move(str(package_path), archive_dir / f"pipi-volleyball-web-{timestamp}.zip")

    with ZipFile(package_path, "w", ZIP_DEFLATED) as zip_file:
        for path in DIST_DIR.rglob("*"):
            if path.is_file():
                zip_file.write(path, path.relative_to(DIST_DIR))
        zip_file.writestr("README_LOCAL_TEST.txt", local_test_readme())
        zip_file.writestr("start-local-preview.bat", local_preview_bat())

    print(f"Created release package: {package_path}")
    print("Upload the contents of this zip to your company web host.")
    return 0


def local_test_readme() -> str:
    return """Pipi Volleyball local test

Do not open this game directly inside the zip file.

Steps:
1. Extract the whole zip folder first.
2. Double-click start-local-preview.bat.
3. Open http://127.0.0.1:5173 in Chrome or Edge.

If the batch file says Python or Node is missing, install one of them first.

For company web hosting, upload the extracted contents of this zip:
- index.html
- assets/
"""


def local_preview_bat() -> str:
    return """@echo off
setlocal
cd /d "%~dp0"
echo Starting local preview server for Pipi Volleyball...
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo Open http://127.0.0.1:5173
  py -m http.server 5173 --bind 127.0.0.1
  exit /b
)
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo Open http://127.0.0.1:5173
  python -m http.server 5173 --bind 127.0.0.1
  exit /b
)
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  echo Open http://127.0.0.1:5173
  npx --yes http-server -p 5173 -a 127.0.0.1
  exit /b
)
echo Could not find Python or Node.js.
echo Please install Python or Node.js, then run this file again.
pause
"""


if __name__ == "__main__":
    raise SystemExit(main())
