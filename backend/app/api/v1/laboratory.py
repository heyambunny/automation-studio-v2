import os
import io
import re
import json
import uuid
import zipfile
import tempfile
import threading
from copy import copy
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
import openpyxl
import pandas as pd
from app.core.security import decode_token
from app.services.excel_service import _converted_xlsx
from app.services import kitchen_service

router = APIRouter(prefix="/laboratory", tags=["laboratory"])

KITCHEN_UPLOADS_DIR = os.path.join("uploads", "kitchen")
KITCHEN_RECIPES_DIR = os.path.join("recipes", "kitchen")

MAX_RECOMMENDED_GROUPS = 300

# One workbook job at a time: each holds a whole master file plus a copy per
# branch in memory (~2 GB peak seen), and the server has no swap. A queued job
# waits briefly, then gets a clear "busy" error instead of hitting nginx's 300s
# proxy timeout behind a long split.
_heavy_job_slot = threading.Semaphore(1)
_HEAVY_JOB_WAIT_SECONDS = 90


def _one_heavy_job_at_a_time():
    if not _heavy_job_slot.acquire(timeout=_HEAVY_JOB_WAIT_SECONDS):
        raise HTTPException(
            status_code=503,
            detail="Another large file is being processed right now - please try again in a minute or two.",
        )
    try:
        yield
    finally:
        _heavy_job_slot.release()


def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")


def _sanitize_filename(value: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', "_", str(value)).strip()
    return (name or "Unnamed")[:100]


def _save_upload(file: UploadFile) -> str:
    suffix = os.path.splitext(file.filename or "")[1].lower() or ".xlsx"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(file.file.read())
    tmp.close()
    return tmp.name


def _resolve_workbook_path(tmp_path: str) -> str:
    """.xlsb has no Python reader that exposes cell styles, so route it
    through the same LibreOffice conversion the rest of the app already uses
    for exact-formatting rendering."""
    if tmp_path.lower().endswith(".xlsb"):
        converted = _converted_xlsx(tmp_path)
        if not converted:
            raise HTTPException(status_code=400, detail="Could not read this .xlsb file - LibreOffice conversion failed")
        return converted
    return tmp_path


def _find_header_row(ws):
    """First row with any non-empty cell is treated as the header row - master
    reports are expected to be a single flat table per sheet, optionally
    preceded by blank rows."""
    for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 20)):
        if any(c.value not in (None, "") for c in row):
            return row[0].row
    return 1


def _sheet_headers(ws):
    """Returns (header_row_idx, header_cells, last_col, headers)."""
    header_row_idx = _find_header_row(ws)
    header_cells = list(ws[header_row_idx])
    last_col = 0
    for c in header_cells:
        if c.value not in (None, ""):
            last_col = c.column
    headers = [str(ws.cell(row=header_row_idx, column=i).value or "") for i in range(1, last_col + 1)]
    return header_row_idx, header_cells, last_col, headers


def _column_summary(name: str, unique_vals: list, row_count: int) -> dict:
    unique_count = len(unique_vals)
    recommended = 1 < unique_count < max(2, row_count) and unique_count <= MAX_RECOMMENDED_GROUPS
    return {
        "name": name,
        "unique_count": unique_count,
        "sample_values": unique_vals[:8],
        "recommended": recommended,
    }


def _copy_cell_style(src, dest):
    dest.font = copy(src.font)
    dest.fill = copy(src.fill)
    dest.border = copy(src.border)
    dest.alignment = copy(src.alignment)
    dest.number_format = src.number_format


@router.post("/analyze")
def analyze_file(
    file: UploadFile = File(...),
    auth: tuple = Depends(get_current_user),
    _slot: None = Depends(_one_heavy_job_at_a_time),
):
    """Read every sheet of an uploaded master file and report only the
    columns that exist in ALL of them - those are the only ones that can
    split every sheet consistently, so they're the only ones offered."""
    tmp_path = _save_upload(file)
    try:
        is_csv = tmp_path.lower().endswith(".csv")
        if is_csv:
            df = pd.read_csv(tmp_path, dtype=str)
            headers = [str(c) for c in df.columns]
            row_count = len(df)
            columns = []
            for col in headers:
                values = df[col].dropna().astype(str)
                values = values[values.str.strip() != ""]
                unique_vals = values.unique().tolist()
                columns.append(_column_summary(col, unique_vals, row_count))
            return {"sheet_names": None, "sheets_analyzed": 1, "row_count": row_count, "columns": columns}

        work_path = _resolve_workbook_path(tmp_path)
        wb = openpyxl.load_workbook(work_path, data_only=True)
        sheet_names = wb.sheetnames

        per_sheet = {}
        header_sets = []
        first_sheet_headers = None
        total_rows = 0
        for sname in sheet_names:
            ws = wb[sname]
            header_row_idx, header_cells, last_col, headers = _sheet_headers(ws)
            data_rows = list(ws.iter_rows(min_row=header_row_idx + 1, max_col=last_col, values_only=True)) if last_col else []
            per_sheet[sname] = {"headers": headers, "data_rows": data_rows}
            header_sets.append(set(headers))
            if first_sheet_headers is None:
                first_sheet_headers = headers
            total_rows += len(data_rows)

        common_columns = set.intersection(*header_sets) if header_sets else set()
        # keep the first sheet's column order for anything that's common to all
        ordered_common = [c for c in (first_sheet_headers or []) if c in common_columns and c]

        columns = []
        for col_name in ordered_common:
            all_values: list = []
            for sname in sheet_names:
                headers = per_sheet[sname]["headers"]
                idx = headers.index(col_name)
                for r in per_sheet[sname]["data_rows"]:
                    v = r[idx]
                    if v not in (None, "") and str(v).strip() != "":
                        all_values.append(str(v).strip())
            unique_vals = list(dict.fromkeys(all_values))
            columns.append(_column_summary(col_name, unique_vals, total_rows))

        return {"sheet_names": sheet_names, "sheets_analyzed": len(sheet_names), "row_count": total_rows, "columns": columns}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def build_branch_workbooks(wb, sheet_names: list, column_name: str) -> dict:
    """Split every sheet of an already-loaded workbook by column_name at
    once: each returned workbook gets one branch's rows from every original
    sheet, so a multi-sheet master report (e.g. Summary/Enrollment/Redemption)
    produces one multi-sheet workbook per branch instead of splitting only one
    sheet. Shared by /split (zips the result) and Kitchen (adds a generated
    Summary sheet to each before zipping/uploading)."""
    sheet_infos = {}
    for sname in sheet_names:
        ws = wb[sname]
        header_row_idx, header_cells, last_col, headers = _sheet_headers(ws)
        if column_name not in headers:
            raise HTTPException(
                status_code=400,
                detail=f"Column \"{column_name}\" is missing from sheet \"{sname}\" - it must exist in every sheet to split by it",
            )
        col_idx = headers.index(column_name) + 1
        col_widths = {
            i: ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width
            for i in range(1, last_col + 1) if openpyxl.utils.get_column_letter(i) in ws.column_dimensions
        }
        sheet_infos[sname] = {
            "header_cells": header_cells,
            "last_col": last_col,
            "col_widths": col_widths,
            "rows_by_group": {},
        }
        for row in ws.iter_rows(min_row=header_row_idx + 1, max_col=last_col):
            key_cell = row[col_idx - 1]
            if key_cell.value in (None, "") or str(key_cell.value).strip() == "":
                continue
            key = str(key_cell.value).strip()
            sheet_infos[sname]["rows_by_group"].setdefault(key, []).append(row)

    group_order: list = []
    seen = set()
    for sname in sheet_names:
        for key in sheet_infos[sname]["rows_by_group"]:
            if key not in seen:
                seen.add(key)
                group_order.append(key)

    if not group_order:
        raise HTTPException(status_code=400, detail=f"No data rows found under column \"{column_name}\" in any sheet")

    result = {}
    for group_value in group_order:
        out_wb = openpyxl.Workbook()
        out_wb.remove(out_wb.active)

        for sname in sheet_names:
            info = sheet_infos[sname]
            out_ws = out_wb.create_sheet(title=(sname or "Sheet1")[:31])

            for i in range(1, info["last_col"] + 1):
                letter = openpyxl.utils.get_column_letter(i)
                if i in info["col_widths"]:
                    out_ws.column_dimensions[letter].width = info["col_widths"][i]

            for c in info["header_cells"][:info["last_col"]]:
                dest = out_ws.cell(row=1, column=c.column, value=c.value)
                _copy_cell_style(c, dest)

            rows = info["rows_by_group"].get(group_value, [])
            for r_idx, row in enumerate(rows, start=2):
                for c in row:
                    dest = out_ws.cell(row=r_idx, column=c.column, value=c.value)
                    _copy_cell_style(c, dest)

        result[group_value] = out_wb

    return result


@router.post("/split")
def split_file(
    file: UploadFile = File(...),
    column_name: str = Form(...),
    auth: tuple = Depends(get_current_user),
    _slot: None = Depends(_one_heavy_job_at_a_time),
):
    """Split every sheet of the uploaded file by column_name at once: each
    output file gets one branch's rows from every original sheet, so a
    multi-sheet master report (e.g. Summary/Enrollment/Redemption) produces
    one multi-sheet file per branch instead of splitting only one sheet."""
    tmp_path = _save_upload(file)
    try:
        is_csv = tmp_path.lower().endswith(".csv")
        zip_buffer = io.BytesIO()

        if is_csv:
            df = pd.read_csv(tmp_path, dtype=str)
            if column_name not in df.columns:
                raise HTTPException(status_code=400, detail=f"Column \"{column_name}\" not found")
            groups = df.groupby(df[column_name].fillna("Unassigned").astype(str).str.strip())
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for group_value, group_df in groups:
                    out = io.StringIO()
                    group_df.to_csv(out, index=False)
                    zf.writestr(f"{_sanitize_filename(group_value)}.csv", out.getvalue())
        else:
            work_path = _resolve_workbook_path(tmp_path)
            wb = openpyxl.load_workbook(work_path, data_only=True)
            sheet_names = wb.sheetnames

            branch_workbooks = build_branch_workbooks(wb, sheet_names, column_name)
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
                for group_value, out_wb in branch_workbooks.items():
                    file_bytes = io.BytesIO()
                    out_wb.save(file_bytes)
                    zf.writestr(f"{_sanitize_filename(group_value)}.xlsx", file_bytes.getvalue())

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=split_files.zip"},
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# --- Kitchen: learn a formula recipe from example reports, apply it to every branch ---

@router.post("/kitchen/train")
def kitchen_train(
    example_files: List[UploadFile] = File(...),
    summary_sheet: str = Form("Summary"),
    raw_sheet: str = Form("Raw Data"),
    auth: tuple = Depends(get_current_user),
    _slot: None = Depends(_one_heavy_job_at_a_time),
):
    """Learn a recipe from 2+ finished example branch reports. Each example's
    filename (minus extension) is taken as its branch name - the same
    convention New Campaign and Data Split already use. Examples are saved
    (not left as temp files) so a recipe can reference them again later, e.g.
    on regeneration after being saved and reloaded."""
    if len(example_files) < 2:
        raise HTTPException(status_code=400, detail="Upload at least 2 example reports so Kitchen can cross-check the formula pattern across branches")

    training_id = str(uuid.uuid4())[:8]
    training_dir = os.path.join(KITCHEN_UPLOADS_DIR, training_id)
    os.makedirs(training_dir, exist_ok=True)

    examples = []
    for file in example_files:
        branch = os.path.splitext(file.filename or "")[0]
        dest_path = os.path.join(training_dir, file.filename)
        with open(dest_path, "wb") as f:
            f.write(file.file.read())
        examples.append({"id": branch, "branch": branch, "path": dest_path})

    try:
        recipe = kitchen_service.build_recipe(examples, summary_sheet, raw_sheet)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing sheet {e} - every example needs both a \"{summary_sheet}\" and a \"{raw_sheet}\" sheet")

    return {
        "training_id": training_id,
        "recipe": recipe,
        "rules": kitchen_service.render_rule_list(recipe),
    }


@router.post("/kitchen/generate")
def kitchen_generate(
    master_file: UploadFile = File(...),
    column_name: str = Form(...),
    recipe: str = Form(...),
    overrides: str = Form("{}"),
    output_mode: str = Form("download"),
    auth: tuple = Depends(get_current_user),
    _slot: None = Depends(_one_heavy_job_at_a_time),
):
    """Apply a (possibly manually-edited) recipe to every branch found in the
    master file, generating a matching Summary sheet for each - including
    branches that weren't training examples at all."""
    try:
        recipe_dict = json.loads(recipe)
        overrides_dict = json.loads(overrides)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="recipe/overrides must be valid JSON")

    recipe_dict = kitchen_service.apply_overrides(recipe_dict, overrides_dict)
    unresolved = [r["coord"] for r in kitchen_service.render_rule_list(recipe_dict) if not r["resolved"]]
    if unresolved:
        raise HTTPException(status_code=400, detail=f"These cells still need your input before generating: {', '.join(unresolved)}")

    tmp_path = _save_upload(master_file)
    try:
        work_path = _resolve_workbook_path(tmp_path)
        wb = openpyxl.load_workbook(work_path, data_only=True)
        raw_sheet = recipe_dict["raw_sheet"]
        if raw_sheet not in wb.sheetnames:
            raise HTTPException(
                status_code=400,
                detail=f"The master file has no sheet named \"{raw_sheet}\" - the recipe expects the same raw-data sheet name the training examples used",
            )

        branch_workbooks = build_branch_workbooks(wb, wb.sheetnames, column_name)

        warnings = {}
        for branch, branch_wb in branch_workbooks.items():
            raw_ws = branch_wb[raw_sheet]
            _, _, headers = kitchen_service.sheet_headers(raw_ws)
            out_ws = branch_wb.create_sheet(recipe_dict["summary_sheet"])
            needs_review = kitchen_service.regenerate_summary(
                recipe_dict, recipe_dict["style_source_path"], raw_ws, headers, branch, out_ws
            )
            if needs_review:
                warnings[branch] = needs_review

        if output_mode == "campaign_folder":
            campaign_folder_id = str(uuid.uuid4())[:8]
            campaign_folder = os.path.join("uploads", "campaigns", campaign_folder_id)
            os.makedirs(campaign_folder, exist_ok=True)
            for branch, branch_wb in branch_workbooks.items():
                branch_wb.save(os.path.join(campaign_folder, f"{_sanitize_filename(branch)}.xlsx"))
            return {
                "campaign_folder": campaign_folder,
                "campaign_folder_id": campaign_folder_id,
                "branches": list(branch_workbooks.keys()),
                "warnings": warnings,
            }

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for branch, branch_wb in branch_workbooks.items():
                file_bytes = io.BytesIO()
                branch_wb.save(file_bytes)
                zf.writestr(f"{_sanitize_filename(branch)}.xlsx", file_bytes.getvalue())
            if warnings:
                zf.writestr("_kitchen_warnings.json", json.dumps(warnings, indent=2))
        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=kitchen_reports.zip"},
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


class KitchenRecipeCreate(BaseModel):
    saved_name: str
    config: dict


@router.post("/kitchen/recipes")
def save_kitchen_recipe(payload: KitchenRecipeCreate, auth: tuple = Depends(get_current_user)):
    """Persists a trained recipe for reuse on a future data dump without
    retraining - same plain-JSON-file pattern as /campaigns/recipes."""
    user_id, role = auth
    os.makedirs(KITCHEN_RECIPES_DIR, exist_ok=True)
    filename = f"{payload.saved_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    config = dict(payload.config)
    config["saved_name"] = payload.saved_name
    config["saved_at"] = datetime.now().isoformat()
    config["user_id"] = user_id
    with open(os.path.join(KITCHEN_RECIPES_DIR, filename), "w") as f:
        json.dump(config, f, indent=2)
    return {"filename": filename, "saved_name": payload.saved_name}


@router.get("/kitchen/recipes")
def list_kitchen_recipes(auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if not os.path.isdir(KITCHEN_RECIPES_DIR):
        return []
    result = []
    for fn in os.listdir(KITCHEN_RECIPES_DIR):
        if not fn.endswith(".json"):
            continue
        with open(os.path.join(KITCHEN_RECIPES_DIR, fn)) as f:
            data = json.load(f)
        if role != "admin" and data.get("user_id") != user_id:
            continue
        result.append({**data, "filename": fn})
    result.sort(key=lambda r: r.get("saved_at", ""), reverse=True)
    return result


@router.delete("/kitchen/recipes/{filename}")
def delete_kitchen_recipe(filename: str, auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    path = os.path.join(KITCHEN_RECIPES_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Recipe not found")
    with open(path) as f:
        data = json.load(f)
    if role != "admin" and data.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    os.remove(path)
    return {"message": "Recipe deleted"}
