"""Checks on the uploaded branch files themselves, against the mapping.

run_campaign() attaches the file named "<branch>.xlsx" (or .xls/.xlsb/.csv) from
the campaign folder and, when none is found, still sends the email - just with
no attachment and an empty {{Summary}}. This module spots that before sending,
mirroring the sender's exact lookup (so a capitalisation difference, which a
case-insensitive match in the browser would miss, is caught too), and checks
that a file's own branch column agrees with the branch in its filename.
"""
import csv
import os
import re
import time
from typing import Optional

import openpyxl

FILE_EXTS = (".xlsx", ".xls", ".xlsb", ".csv")
_BRANCH_HEADERS = {"branch", "branch name", "branchname", "branch_name"}
_MAX_ROWS_SCANNED = 20000
_TIME_BUDGET_SECONDS = 20
_HEADER_SEARCH_ROWS = 20

_UPLOADS_ROOT = os.path.join("uploads", "campaigns")


def _norm(value) -> str:
    return re.sub(r"[\s_]+", " ", str(value or "").strip()).lower()


def _stem(name: str) -> str:
    return os.path.splitext(name)[0]


def resolve_campaign_folder(folder) -> Optional[str]:
    """The folder as a real path - only if it is a directory inside uploads/campaigns."""
    if not folder:
        return None
    root = os.path.realpath(_UPLOADS_ROOT)
    real = os.path.realpath(folder)
    if real == root or not real.startswith(root + os.sep) or not os.path.isdir(real):
        return None
    return real


def _short(items, limit=6) -> str:
    items = list(items)
    return ", ".join(items[:limit]) + (f" +{len(items) - limit} more" if len(items) > limit else "")


def _find_branch_col(header_row) -> Optional[int]:
    for i, cell in enumerate(header_row or ()):
        if _norm(cell) in _BRANCH_HEADERS:
            return i
    return None


def _branch_values(path: str) -> Optional[set]:
    """Distinct (normalised) values in the file's branch column, or None when it
    has no such column / can't be read cheaply (.xls, .xlsb)."""
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".csv":
            with open(path, newline="", encoding="utf-8-sig", errors="replace") as fh:
                reader = csv.reader(fh)
                header = next(reader, None)
                idx = _find_branch_col(header)
                if idx is None:
                    return None
                values = set()
                for n, row in enumerate(reader):
                    if n >= _MAX_ROWS_SCANNED:
                        break
                    if idx < len(row) and _norm(row[idx]):
                        values.add(_norm(row[idx]))
                return values
        if ext not in (".xlsx", ".xlsm"):
            return None
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        try:
            found, values = False, set()
            for ws in wb.worksheets:
                idx = None
                for n, row in enumerate(ws.iter_rows(max_row=_MAX_ROWS_SCANNED + _HEADER_SEARCH_ROWS, values_only=True)):
                    if idx is None:
                        if n >= _HEADER_SEARCH_ROWS:
                            break
                        if any(c not in (None, "") for c in row):
                            idx = _find_branch_col(row)
                            if idx is None:
                                break  # first non-empty row is this sheet's header and has no branch column
                            found = True
                        continue
                    if idx < len(row) and _norm(row[idx]):
                        values.add(_norm(row[idx]))
            return values if found else None
        finally:
            wb.close()
    except Exception:
        return None


def check_files(folder: str, branches: list, deep: bool = True) -> dict:
    """Compare the folder's files with the mapping's branches.

    branches: branch names as the sender will use them (extension already stripped)."""
    issues = []
    names = os.listdir(folder)
    lower_names = {n.lower(): n for n in names}
    data_files = [n for n in names if n.lower().endswith(FILE_EXTS)]

    missing, case_only, matched = [], [], {}
    for branch in branches:
        exact = next((f"{branch}{ext}" for ext in FILE_EXTS if f"{branch}{ext}" in names), None)
        if exact:
            matched[branch] = os.path.join(folder, exact)
            continue
        near = next((lower_names[f"{branch}{ext}".lower()] for ext in FILE_EXTS if f"{branch}{ext}".lower() in lower_names), None)
        if near:
            case_only.append((branch, near))
        else:
            missing.append(branch)

    if missing:
        issues.append({
            "type": "missing_files",
            "severity": "warn",
            "branch": missing[0],
            "message": (
                f"{len(missing)} branch(es) have no file in this upload, so their email would go out with no attachment "
                f"and an empty summary: {_short(missing)}."
            ),
            "details": {"branches": missing},
        })
    for branch, actual in case_only:
        issues.append({
            "type": "missing_files",
            "severity": "warn",
            "branch": branch,
            "message": f"The file is named \"{actual}\" but the branch is \"{branch}\" - the capitalisation must match exactly, otherwise it won't be attached.",
            "details": {"branches": [branch]},
        })

    mapped_stems = {b.lower() for b in branches}
    extra = [n for n in data_files if _stem(n).lower() not in mapped_stems]
    if extra:
        issues.append({
            "type": "extra_files",
            "severity": "info",
            "branch": extra[0],
            "message": f"{len(extra)} uploaded file(s) don't match any branch in this mapping and won't be sent: {_short(extra)}.",
            "details": {"files": extra},
        })

    checked = 0
    if deep:
        deadline = time.monotonic() + _TIME_BUDGET_SECONDS
        for branch, path in matched.items():
            if time.monotonic() > deadline:
                break
            values = _branch_values(path)
            if values is None:
                continue
            checked += 1
            expected = _norm(branch)
            others = sorted(values - {expected})
            if values and expected not in values:
                issues.append({
                    "type": "file_mismatch",
                    "severity": "warn",
                    "branch": branch,
                    "message": f"{os.path.basename(path)}: its Branch column says {_short(others, 3)} - none of its rows are for {branch}.",
                    "details": {"found": others},
                })
            elif others:
                issues.append({
                    "type": "file_mismatch",
                    "severity": "warn",
                    "branch": branch,
                    "message": f"{os.path.basename(path)}: also contains rows for other branches ({_short(others, 3)}), not just {branch}.",
                    "details": {"found": others},
                })

    return {"issues": issues, "files_checked": checked, "files_total": len(matched)}
