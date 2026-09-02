"""ZIP extraction and path-traversal-safe file handling."""

import os
import uuid
import zipfile
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import get_settings

settings = get_settings()

# The upload-size limit only bounds the *compressed* file. Without a separate
# cap on decompressed size, a crafted archive well under the compressed limit
# can still expand to gigabytes on disk (a "zip bomb") -- these caps are what
# actually prevent that, independent of how small the uploaded file looks.
MAX_UNCOMPRESSED_TOTAL_BYTES = 1_000 * 1024 * 1024  # 1GB decompressed, generous for a real source repo
MAX_COMPRESSION_RATIO = 100  # a single member expanding >100x is a zip-bomb signature, not real source
MAX_ZIP_ENTRIES = 50_000  # bounds extraction time and inode usage regardless of byte size


async def save_and_extract_zip(upload: UploadFile, dest_root: str) -> str:
    """Validate, save, and safely extract an uploaded ZIP. Returns the extraction directory."""
    if not upload.filename or not upload.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip file uploads are supported")

    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    contents = await upload.read()
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=413, detail=f"File exceeds max upload size of {settings.max_upload_size_mb}MB"
        )

    os.makedirs(dest_root, exist_ok=True)
    repo_id = str(uuid.uuid4())
    zip_path = Path(dest_root) / f"{repo_id}.zip"
    extract_dir = Path(dest_root) / repo_id

    with open(zip_path, "wb") as f:
        f.write(contents)

    try:
        with zipfile.ZipFile(zip_path) as zf:
            _validate_zip_paths(zf, extract_dir)
            _validate_zip_capacity(zf)
            zf.extractall(extract_dir)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid ZIP archive") from exc
    finally:
        zip_path.unlink(missing_ok=True)

    return str(extract_dir)


def _validate_zip_paths(zf: zipfile.ZipFile, extract_dir: Path) -> None:
    """Prevent Zip Slip: ensure every member resolves inside extract_dir."""
    resolved_root = extract_dir.resolve()
    for member in zf.namelist():
        member_path = (extract_dir / member).resolve()
        if not str(member_path).startswith(str(resolved_root)):
            raise HTTPException(status_code=400, detail=f"Unsafe path in archive: {member}")


def _validate_zip_capacity(zf: zipfile.ZipFile) -> None:
    """Prevent zip-bomb DoS: caps total decompressed size, per-entry compression
    ratio, and entry count -- all read from the (trusted, cheap) central directory
    metadata, so this never has to actually decompress anything to reject a bomb.
    """
    infos = zf.infolist()
    if len(infos) > MAX_ZIP_ENTRIES:
        raise HTTPException(
            status_code=400, detail=f"Archive contains too many files (max {MAX_ZIP_ENTRIES})"
        )

    total_uncompressed = 0
    for info in infos:
        total_uncompressed += info.file_size
        if total_uncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Archive would decompress to over {MAX_UNCOMPRESSED_TOTAL_BYTES // (1024 * 1024)}MB",
            )
        if info.compress_size > 0 and info.file_size / info.compress_size > MAX_COMPRESSION_RATIO:
            raise HTTPException(status_code=400, detail=f"Suspicious compression ratio in archive entry: {info.filename}")
