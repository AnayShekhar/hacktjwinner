from __future__ import annotations

import base64
from typing import Literal, Tuple


FileType = Literal["image", "pdf"]


def decode_base64_content(content_base64: str) -> bytes:
    """
    Decode a base64-encoded image or PDF payload.
    """
    return base64.b64decode(content_base64)


def sniff_file_type(file_type: str) -> FileType:
    """
    Normalize the provided file_type into one of the supported literals.
    """
    lowered = file_type.lower()
    if "pdf" in lowered:
        return "pdf"
    return "image"


__all__ = ["decode_base64_content", "sniff_file_type", "FileType"]

