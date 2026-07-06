#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
"""Lightweight checks for LispBM source files.

This does not replace VESC Tool's LispBM parser. It catches common local edit
mistakes before uploading: unbalanced delimiters, unterminated strings, and
non-ASCII characters.
"""

from __future__ import annotations

import pathlib
import sys


OPEN_TO_CLOSE = {"(": ")", "[": "]", "{": "}"}
CLOSE_TO_OPEN = {v: k for k, v in OPEN_TO_CLOSE.items()}


def check_file(path: pathlib.Path) -> list[str]:
    errors: list[str] = []
    stack: list[tuple[str, int, int]] = []
    in_string = False
    escape = False

    text = path.read_text(encoding="utf-8")
    for line_no, line in enumerate(text.splitlines(), start=1):
        try:
            line.encode("ascii")
        except UnicodeEncodeError:
            errors.append(f"{path}:{line_no}: non-ASCII character found")

        comment = False
        for col, ch in enumerate(line, start=1):
            if comment:
                continue

            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == ";":
                comment = True
            elif ch == '"':
                in_string = True
            elif ch in OPEN_TO_CLOSE:
                stack.append((ch, line_no, col))
            elif ch in CLOSE_TO_OPEN:
                if not stack:
                    errors.append(f"{path}:{line_no}:{col}: unexpected {ch!r}")
                    continue
                opener, open_line, open_col = stack.pop()
                if opener != CLOSE_TO_OPEN[ch]:
                    errors.append(
                        f"{path}:{line_no}:{col}: {ch!r} closes {opener!r} "
                        f"from {open_line}:{open_col}"
                    )

    if in_string:
        errors.append(f"{path}: unterminated string literal")

    for opener, line_no, col in reversed(stack):
        errors.append(f"{path}:{line_no}:{col}: unclosed {opener!r}")

    return errors


def main(argv: list[str]) -> int:
    paths = [pathlib.Path(arg) for arg in argv[1:]]
    if not paths:
        print("usage: lispbm_static_check.py FILE...", file=sys.stderr)
        return 2

    errors: list[str] = []
    for path in paths:
        errors.extend(check_file(path))

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    for path in paths:
        print(f"ok: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
