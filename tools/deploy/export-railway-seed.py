"""Package local Studio data and runtime assets for an initial Railway volume."""
from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[2]
destination = root / ".studio" / "railway-seed.tar.gz"
destination.parent.mkdir(exist_ok=True)
sources = [(root / ".studio/projects", "studio/projects"),
           (root / ".studio/game", "studio/game"),
           (root / "apps/web/public/assets", "assets"),
           (root / "docs/troia/first-battle/assets", "assets/troia/legacy")]
count = 0
with tarfile.open(destination, "w:gz", compresslevel=1) as archive:
    for directory, prefix in sources:
        for file in sorted(directory.rglob("*")):
            relative = file.relative_to(directory)
            if not file.is_file() or file.is_symlink() or any(p.startswith(".") for p in relative.parts):
                continue
            if file.suffix.lower() not in {".json", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".mp3", ".ogg", ".wav", ".m4a", ".mp4", ".webm", ".woff", ".woff2", ".ttf"}:
                continue
            archive.add(file, arcname=f"{prefix}/{relative.as_posix()}", recursive=False)
            count += 1
print(f"{destination}: {count} files, {destination.stat().st_size / 1024**2:.1f} MiB")
print("Local export only. No files were uploaded or deployed.")
