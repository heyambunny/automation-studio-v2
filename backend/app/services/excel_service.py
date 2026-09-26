import pandas as pd
import openpyxl
import openpyxl.utils
import re
import os
import html as html_lib
import datetime as dt
import shutil
import subprocess
import tempfile
import zipfile
import hashlib
import atexit
from xml.etree import ElementTree

def detect_active_range(file_path: str, sheet_name: str, start_cell: str = ""):
    """Auto-detect the active range in a sheet, capturing all contiguous data"""
    try:
        # Handle .xlsb with pyxlsb
        if file_path.endswith('.xlsb'):
            from pyxlsb import open_workbook
            with open_workbook(file_path) as wb:
                with wb.get_sheet(sheet_name) as sheet:
                    data = []
                    for row in sheet.rows():
                        row_data = []
                        for cell in row:
                            val = cell.v
                            if val is None:
                                val = ''
                            elif isinstance(val, float) and val == int(val):
                                val = int(val)  # Remove decimal for whole numbers
                            elif isinstance(val, float):
                                val = round(val, 2)  # Keep 2 decimal places for actual decimals
                            row_data.append(val)
                        data.append(row_data)
                    
                    if data:
                        df = pd.DataFrame(data)
                        df.columns = df.iloc[0]
                        df = df.iloc[1:]
                        df = df.reset_index(drop=True)
                        return df
                    return None
        
        wb = openpyxl.load_workbook(file_path, data_only=True)
        ws = wb[sheet_name]
        
        # Determine start position
        if start_cell:
            col_letter = "".join(c for c in start_cell if c.isalpha())
            start_row = int("".join(c for c in start_cell if c.isdigit()))
            min_col = ws[f"{col_letter}1"].column
            min_row = start_row
        else:
            # Auto-detect: find first non-empty cell
            min_row = ws.min_row
            min_col = ws.min_column
            found = False
            for r in range(ws.min_row, ws.max_row + 1):
                for c in range(ws.min_column, ws.max_column + 1):
                    if ws.cell(row=r, column=c).value is not None:
                        min_row = r
                        min_col = c
                        found = True
                        break
                if found:
                    break
        
        max_row = min_row
        max_col = min_col
        
        # Expand to include all contiguous data
        # Expand down until we find completely empty row
        for r in range(min_row, ws.max_row + 1):
            row_has_data = any(ws.cell(row=r, column=c).value is not None 
                              for c in range(min_col, ws.max_column + 1))
            if row_has_data:
                max_row = r
            elif r > min_row + 1:  # Break if 2 consecutive empty rows
                break
        
        # Expand right until we find completely empty column
        for c in range(min_col, ws.max_column + 1):
            col_has_data = any(ws.cell(row=r, column=c).value is not None 
                              for r in range(min_row, max_row + 1))
            if col_has_data:
                max_col = c
            elif c > min_col + 1:
                break
        
        # Extract data
        data = []
        for r in range(min_row, max_row + 1):
            row_data = []
            for c in range(min_col, max_col + 1):
                cell = ws.cell(row=r, column=c)
                val = cell.value
                if val is None or (isinstance(val, str) and val.strip() == ''):
                    val = ''
                row_data.append(val)
            data.append(row_data)
        
        # Convert to DataFrame
        if data:
            df = pd.DataFrame(data)
            df.columns = df.iloc[0]
            df = df.iloc[1:]
            df = df.reset_index(drop=True)
            wb.close()
            return df
        wb.close()
        return None
    except Exception as e:
        print(f"Error detecting range: {e}")
        return None

def _plain_table_html(df):
    """Faithful, unstyled HTML table for sources that carry no cell formatting
    (CSV, or .xlsb when exact rendering is disabled). No invented colours,
    progress bars or row striping - just the data in a bordered grid."""
    if df is None or getattr(df, "empty", True):
        return ""

    out = [
        '<table role="presentation" cellspacing="0" cellpadding="0" '
        'style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;'
        'font-size:11pt;color:#000000;line-height:1.3;">'
    ]
    out.append("<tr>")
    for col in df.columns:
        out.append(
            '<td style="padding:3px 6px;border:1px solid #000000;font-weight:bold;">'
            + html_lib.escape("" if pd.isna(col) else str(col)) + "</td>"
        )
    out.append("</tr>")
    for _, row in df.iterrows():
        out.append("<tr>")
        for val in row:
            if pd.isna(val):
                text = ""
            elif isinstance(val, float) and val.is_integer():
                text = str(int(val))
            else:
                text = str(val)
            out.append(
                '<td style="padding:3px 6px;border:1px solid #000000;">'
                + (html_lib.escape(text) or "&nbsp;") + "</td>"
            )
        out.append("</tr>")
    out.append("</table>")
    return "".join(out)


# ---------------------------------------------------------------------------
# Exact-formatting renderer: reproduce the Excel range as inline-styled HTML
# ---------------------------------------------------------------------------

# Office 2013+ default theme palette, indexed the way openpyxl reports
# ``cell.font.color.theme`` / ``fill.fgColor.theme``.
_THEME_COLORS = [
    "FFFFFF",  # 0  lt1 / background 1
    "000000",  # 1  dk1 / text 1
    "E7E6E6",  # 2  lt2 / background 2
    "44546A",  # 3  dk2 / text 2
    "4472C4",  # 4  accent 1
    "ED7D31",  # 5  accent 2
    "A5A5A5",  # 6  accent 3
    "FFC000",  # 7  accent 4
    "5B9BD5",  # 8  accent 5
    "70AD47",  # 9  accent 6
    "0563C1",  # 10 hyperlink
    "954F72",  # 11 followed hyperlink
]

_BORDER_STYLE = {
    "hair": "1px solid",
    "thin": "1px solid",
    "dotted": "1px dotted",
    "dashed": "1px dashed",
    "dashDot": "1px dashed",
    "dashDotDot": "1px dashed",
    "medium": "2px solid",
    "mediumDashed": "2px dashed",
    "mediumDashDot": "2px dashed",
    "mediumDashDotDot": "2px dashed",
    "slantDashDot": "2px dashed",
    "thick": "3px solid",
    "double": "3px double",
}


def _apply_tint(hex_color: str, tint: float) -> str:
    """Approximate Excel's tint/shade applied to a theme colour."""
    if not tint:
        return hex_color
    try:
        r, g, b = (int(hex_color[i:i + 2], 16) for i in (0, 2, 4))
    except (ValueError, IndexError):
        return hex_color

    def adj(c: int) -> int:
        if tint < 0:
            v = c * (1.0 + tint)
        else:
            v = c * (1.0 - tint) + 255.0 * tint
        return max(0, min(255, int(round(v))))

    return "".join(f"{adj(c):02X}" for c in (r, g, b))


def _color_to_css(color):
    """Convert an openpyxl Color to ``#rrggbb`` or return None."""
    if color is None:
        return None
    try:
        ctype = getattr(color, "type", None)
        if ctype == "rgb" and isinstance(color.rgb, str):
            v = color.rgb
            if len(v) == 8:
                return "#" + v[2:]
            if len(v) == 6:
                return "#" + v
        if ctype == "theme" and color.theme is not None:
            idx = int(color.theme)
            if 0 <= idx < len(_THEME_COLORS):
                return "#" + _apply_tint(_THEME_COLORS[idx], float(getattr(color, "tint", 0.0) or 0.0))
        if ctype == "indexed" and color.indexed is not None:
            from openpyxl.styles.colors import COLOR_INDEX
            idx = int(color.indexed)
            if 0 <= idx < len(COLOR_INDEX):
                v = COLOR_INDEX[idx]
                if isinstance(v, str) and len(v) == 8:
                    return "#" + v[2:]
    except (ValueError, TypeError, AttributeError):
        return None
    return None


def _fill_to_css(fill):
    if fill is None or getattr(fill, "patternType", None) is None:
        return None
    # For solid (and, as an approximation, patterned) fills the visible colour
    # is the foreground colour.
    return _color_to_css(getattr(fill, "fgColor", None))


def _side_to_css(side):
    if side is None or getattr(side, "style", None) is None:
        return None
    css = _BORDER_STYLE.get(side.style, "1px solid")
    return f"{css} {_color_to_css(getattr(side, 'color', None)) or '#000000'}"


def _trim_number(value):
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return repr(round(value, 10)).rstrip("0").rstrip(".")
    return str(value)


def _format_number(value, number_format: str) -> str:
    nf = number_format or "General"
    if nf in ("General", "@", ""):
        return _trim_number(value)

    section = nf.split(";")[0]
    symbol = ""
    for s in ("₹", "$", "€", "£", "¥"):
        if s in section:
            symbol = s
            break
    # strip bracket tokens ([$-409], [Red], [$₹-en-IN] ...), quoted literals and
    # padding/repeat directives so we can read the digit pattern
    stripped = re.sub(r"\[[^\]]*\]", "", section)
    stripped = re.sub(r'"[^"]*"', "", stripped)
    stripped = stripped.replace("*", "").replace("_", "")

    is_percent = "%" in stripped
    work = value * 100 if is_percent else value

    if "." in stripped:
        decimals = len(re.findall(r"[0#]", stripped.split(".", 1)[1]))
    else:
        decimals = 0
    thousands = "," in stripped.split(".", 1)[0]

    negative = work < 0
    magnitude = abs(work)
    body = f"{magnitude:,.{decimals}f}" if thousands else f"{magnitude:.{decimals}f}"
    out = f"{symbol}{body}"
    if is_percent:
        out += "%"
    if negative:
        parens = "(" in nf and ")" in nf
        out = f"({out})" if parens else f"-{out}"
    return out


_DT_TOKENS = ("yyyy", "yy", "mmmm", "mmm", "mm", "m", "dddd", "ddd", "dd", "d",
              "hh", "h", "ss", "s", "am/pm", "a/p")
_DT_MAP = {
    "yyyy": "%Y", "yy": "%y", "mmmm": "%B", "mmm": "%b",
    "dddd": "%A", "ddd": "%a", "dd": "%d", "d": "%d",
    "hh": "%H", "h": "%H", "ss": "%S", "s": "%S",
    "am/pm": "%p", "a/p": "%p",
}


def _format_datetime(value, number_format: str) -> str:
    section = re.sub(r"\[[^\]]*\]", "", (number_format or "").split(";")[0]).strip().lower()
    section = section.replace("\\", "")
    if not section or section == "general":
        if isinstance(value, dt.datetime) and (value.hour or value.minute or value.second):
            return value.strftime("%Y-%m-%d %H:%M")
        if isinstance(value, dt.time):
            return value.strftime("%H:%M")
        return value.strftime("%Y-%m-%d") if isinstance(value, (dt.datetime, dt.date)) else str(value)

    twelve_hour = "am/pm" in section or "a/p" in section
    out = []
    i = 0
    prev_token = ""  # last recognised date/time token, ignoring separators
    while i < len(section):
        for tok in _DT_TOKENS:
            if section.startswith(tok, i):
                if tok in ("h", "hh") and twelve_hour:
                    out.append("%I")
                elif tok in ("m", "mm"):
                    rest = section[i + len(tok):].lstrip(":./- ")
                    if prev_token in ("h", "hh") or rest.startswith(("s", "ss")):
                        out.append("%M")
                    else:
                        out.append("%m")
                else:
                    out.append(_DT_MAP[tok])
                prev_token = tok
                i += len(tok)
                break
        else:
            out.append(section[i])
            i += 1
    try:
        return value.strftime("".join(out))
    except (ValueError, AttributeError):
        return str(value)


def _format_cell_value(cell) -> str:
    value = cell.value
    if value is None:
        return ""
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (dt.datetime, dt.date, dt.time)):
        return _format_datetime(value, cell.number_format)
    if isinstance(value, (int, float)):
        return _format_number(value, cell.number_format)
    return str(value)


def _cell_css(cell, cf=None) -> str:
    parts = ["padding:3px 6px"]
    valign = "bottom"  # Excel's default vertical alignment

    bg = _fill_to_css(cell.fill)
    if bg:
        parts.append(f"background-color:{bg}")

    font = cell.font
    if font is not None:
        if font.bold:
            parts.append("font-weight:bold")
        if font.italic:
            parts.append("font-style:italic")
        decoration = []
        if font.underline and font.underline != "none":
            decoration.append("underline")
        if font.strike:
            decoration.append("line-through")
        if decoration:
            parts.append("text-decoration:" + " ".join(decoration))
        if font.size:
            parts.append(f"font-size:{float(font.size):g}pt")
        if font.name:
            parts.append(f"font-family:'{font.name}',Arial,sans-serif")
        fc = _color_to_css(font.color)
        if fc:
            parts.append(f"color:{fc}")

    align = cell.alignment
    if align is not None:
        if align.horizontal in ("left", "right", "center", "justify"):
            parts.append(f"text-align:{align.horizontal}")
        elif align.horizontal in ("centerContinuous", "distributed"):
            parts.append("text-align:center")
        if align.vertical in ("top", "bottom", "middle"):
            valign = align.vertical
        elif align.vertical in ("center", "distributed", "justify"):
            valign = "middle"
        if align.wrap_text:
            parts.append("white-space:normal")
        else:
            parts.append("white-space:nowrap")

    parts.insert(1, f"vertical-align:{valign}")

    border = cell.border
    if border is not None:
        for name, side in (("top", border.top), ("bottom", border.bottom),
                           ("left", border.left), ("right", border.right)):
            css = _side_to_css(side)
            if css:
                parts.append(f"border-{name}:{css}")

    # Conditional formatting overrides (appended last so they win). Data bars
    # are NOT applied here as a CSS gradient - most mail clients (classic
    # Outlook's Word engine especially) strip `background: linear-gradient`
    # outright, so the bar would silently vanish once the email is actually
    # delivered even though it renders fine in a browser preview. They're
    # rendered as a nested table instead - see _data_bar_html().
    if cf:
        if cf.get("bg"):
            parts.append(f"background-color:{cf['bg']}")
        if cf.get("color"):
            parts.append(f"color:{cf['color']}")
        if cf.get("bold"):
            parts.append("font-weight:bold")
        if cf.get("italic"):
            parts.append("font-style:italic")

    return ";".join(parts)


def _is_percent_cell(cell) -> bool:
    value = cell.value
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    return "%" in (cell.number_format or "")


def _auto_bar_color(pct: float) -> str:
    """Red/amber/green by value, matching the v1 tool's auto progress bars."""
    if pct < 30:
        return "#E2685C"
    if pct < 60:
        return "#F2A857"
    return "#57BB8A"


def _data_bar_html(value_html: str, bar_color: str, pct: float, base_color: str) -> str:
    """Email-safe replacement for Excel's data-bar fill: a value line with a
    thin proportional bar underneath, built from nested tables with solid
    bgcolor cells. Works in Outlook/Gmail/Apple Mail alike, unlike a CSS
    gradient background which most of those strip on delivery."""
    pct = max(0, min(100, round(pct)))
    bar_cells = f'<td bgcolor="{bar_color}" width="{pct}%" style="background-color:{bar_color};font-size:1px;line-height:5px;">&nbsp;</td>'
    if pct < 100:
        bar_cells += f'<td bgcolor="{base_color}" style="background-color:{base_color};font-size:1px;line-height:5px;">&nbsp;</td>'
    return (
        '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">'
        f'<tr><td style="padding:0;">{value_html}</td></tr>'
        '<tr><td style="padding:0 0 1px 0;">'
        f'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:2px;"><tr>{bar_cells}</tr></table>'
        '</td></tr></table>'
    )


def _resolve_sheet(wb, sheet_name: str):
    if sheet_name in wb.sheetnames:
        return wb[sheet_name]
    target = (sheet_name or "").strip().lower()
    for name in wb.sheetnames:
        if name.strip().lower() == target:
            return wb[name]
    return wb[wb.sheetnames[0]]


def _detect_bounds(ws, start_cell: str = ""):
    """Find the bounds of the contiguous data block by streaming the sheet
    (read-only friendly). A single blank row inside the block is tolerated
    (spacer/total rows are common in hand-built summaries); the block ends at
    two consecutive blank rows. Returns ``None`` when the sheet is empty."""
    fixed_col = None
    fixed_row = None
    if start_cell:
        letters = "".join(c for c in start_cell if c.isalpha()) or "A"
        digits = "".join(c for c in start_cell if c.isdigit())
        fixed_col = openpyxl.utils.column_index_from_string(letters)
        fixed_row = int(digits) if digits else 1

    sheet_max_row = ws.max_row or 1
    start_row = fixed_row or 1
    min_row = fixed_row
    min_col = fixed_col
    max_row = None
    max_col = None
    blank_streak = 0

    for r_idx, row in enumerate(ws.iter_rows(min_row=start_row, max_row=sheet_max_row),
                                start=start_row):
        first_c = last_c = None
        for c_idx, cell in enumerate(row, start=1):
            if cell.value in (None, ""):
                continue
            if fixed_col is not None and c_idx < fixed_col:
                continue
            if first_c is None:
                first_c = c_idx
            last_c = c_idx

        if first_c is not None:
            if min_row is None:
                min_row = r_idx
            if min_col is None:
                min_col = first_c
            max_row = r_idx
            max_col = last_c if max_col is None else max(max_col, last_c)
            blank_streak = 0
        elif min_row is not None:
            blank_streak += 1
            if blank_streak >= 2:
                break

        if min_row is not None and r_idx - min_row > 2000:
            break

    if min_row is None or max_row is None:
        return None

    # Safety cap for pathological sheets
    max_row = min(max_row, min_row + 999)
    max_col = min(max_col, min_col + 63)
    return min_row, min_col, max_row, max_col


_OOXML_MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
_OOXML_REL = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"


def _sheet_xml_path(z: "zipfile.ZipFile", sheet_title: str):
    """Resolve a worksheet's part path inside the xlsx zip (workbook.xml ->
    workbook.xml.rels -> xl/worksheets/sheetN.xml), first worksheet as fallback."""
    names = z.namelist()
    try:
        wbx = ElementTree.fromstring(z.read("xl/workbook.xml"))
        rid = None
        for s in wbx.iter(f"{_OOXML_MAIN}sheet"):
            if s.get("name") == sheet_title:
                rid = s.get(f"{_OOXML_REL}id")
                break
        if rid and "xl/_rels/workbook.xml.rels" in names:
            rels = ElementTree.fromstring(z.read("xl/_rels/workbook.xml.rels"))
            for rel in rels:
                if rel.get("Id") == rid:
                    target = rel.get("Target") or ""
                    cand = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
                    if cand in names:
                        return cand
    except Exception:
        pass
    return next((n for n in names if n.startswith("xl/worksheets/sheet")), None)


def _merged_ranges(xlsx_path: str, sheet_title: str):
    """Read a sheet's <mergeCell> refs straight from the xlsx zip - openpyxl's
    fast read-only mode does not expose merged cells."""
    try:
        with zipfile.ZipFile(xlsx_path) as z:
            path = _sheet_xml_path(z, sheet_title)
            if not path:
                return []
            sx = ElementTree.fromstring(z.read(path))
            return [mc.get("ref") for mc in sx.iter(f"{_OOXML_MAIN}mergeCell") if mc.get("ref")]
    except Exception:
        return []


def _xml_color_to_hex(elem):
    """Resolve an OOXML <color>/<fgColor>/<bgColor> element to '#rrggbb'."""
    if elem is None:
        return None
    try:
        rgb = elem.get("rgb")
        if rgb and len(rgb) in (6, 8):
            return "#" + rgb[-6:]
        theme = elem.get("theme")
        if theme is not None:
            idx = int(theme)
            if 0 <= idx < len(_THEME_COLORS):
                tint = float(elem.get("tint") or 0.0)
                return "#" + _apply_tint(_THEME_COLORS[idx], tint)
        indexed = elem.get("indexed")
        if indexed is not None:
            from openpyxl.styles.colors import COLOR_INDEX
            i = int(indexed)
            if 0 <= i < len(COLOR_INDEX) and isinstance(COLOR_INDEX[i], str):
                return "#" + COLOR_INDEX[i][-6:]
    except (ValueError, TypeError):
        return None
    return None


def _read_dxfs(xlsx_path: str):
    """Parse xl/styles.xml <dxfs> -> {dxfId: {'bg','color','bold','italic'}}.
    Handles both Excel's <bgColor>-carries-the-fill quirk and LibreOffice's
    converted form (patternType=solid, colour in <fgColor>)."""
    out = {}
    try:
        with zipfile.ZipFile(xlsx_path) as z:
            if "xl/styles.xml" not in z.namelist():
                return out
            sx = ElementTree.fromstring(z.read("xl/styles.xml"))
        dxfs = sx.find(f"{_OOXML_MAIN}dxfs")
        if dxfs is None:
            return out
        for i, dxf in enumerate(dxfs.findall(f"{_OOXML_MAIN}dxf")):
            entry = {}
            pat = dxf.find(f"{_OOXML_MAIN}fill/{_OOXML_MAIN}patternFill")
            if pat is not None:
                bg = _xml_color_to_hex(pat.find(f"{_OOXML_MAIN}bgColor"))
                fg = _xml_color_to_hex(pat.find(f"{_OOXML_MAIN}fgColor"))
                if bg and bg.lower() not in ("#000000",):
                    entry["bg"] = bg
                elif fg:
                    entry["bg"] = fg
                elif bg:
                    entry["bg"] = bg
            font = dxf.find(f"{_OOXML_MAIN}font")
            if font is not None:
                if font.find(f"{_OOXML_MAIN}b") is not None:
                    entry["bold"] = True
                if font.find(f"{_OOXML_MAIN}i") is not None:
                    entry["italic"] = True
                fc = _xml_color_to_hex(font.find(f"{_OOXML_MAIN}color"))
                if fc:
                    entry["color"] = fc
            out[i] = entry
    except Exception:
        return out
    return out


def _read_conditional_formatting(xlsx_path: str, sheet_title: str):
    """Parse a sheet's <conditionalFormatting>/<cfRule> from the xlsx zip into
    plain dicts (openpyxl exposes CF only in normal mode and never evaluates)."""
    rules = []
    try:
        with zipfile.ZipFile(xlsx_path) as z:
            path = _sheet_xml_path(z, sheet_title)
            if not path:
                return rules
            sx = ElementTree.fromstring(z.read(path))
    except Exception:
        return rules

    def _ranges(sqref):
        out = []
        for ref in (sqref or "").split():
            try:
                out.append(openpyxl.utils.range_boundaries(ref))  # (min_col,min_row,max_col,max_row)
            except (ValueError, TypeError):
                continue
        return out

    for cf in sx.iter(f"{_OOXML_MAIN}conditionalFormatting"):
        ranges = _ranges(cf.get("sqref"))
        if not ranges:
            continue
        for rule in cf.findall(f"{_OOXML_MAIN}cfRule"):
            rtype = rule.get("type")
            entry = {
                "ranges": ranges,
                "type": rtype,
                "priority": int(rule.get("priority") or 999),
                "operator": rule.get("operator"),
                "text": rule.get("text"),
                "dxfId": int(rule.get("dxfId")) if rule.get("dxfId") is not None else None,
                "formulas": [f.text for f in rule.findall(f"{_OOXML_MAIN}formula") if f.text],
                "rank": int(rule.get("rank") or 0),
                "percent": rule.get("percent") == "1",
                "bottom": rule.get("bottom") == "1",
                "above_average": rule.get("aboveAverage", "1") == "1",
                "equal_average": rule.get("equalAverage") == "1",
                "std_dev": int(rule.get("stdDev")) if rule.get("stdDev") is not None else None,
                "color_scale": None,
                "data_bar": None,
                "icon_set": None,
            }
            cs = rule.find(f"{_OOXML_MAIN}colorScale")
            if cs is not None:
                entry["color_scale"] = {
                    "cfvo": [(v.get("type"), v.get("val")) for v in cs.findall(f"{_OOXML_MAIN}cfvo")],
                    "colors": [_xml_color_to_hex(c) for c in cs.findall(f"{_OOXML_MAIN}color")],
                }
            db = rule.find(f"{_OOXML_MAIN}dataBar")
            if db is not None:
                entry["data_bar"] = {
                    "cfvo": [(v.get("type"), v.get("val")) for v in db.findall(f"{_OOXML_MAIN}cfvo")],
                    "color": _xml_color_to_hex(db.find(f"{_OOXML_MAIN}color")) or "#638EC6",
                }
            ic = rule.find(f"{_OOXML_MAIN}iconSet")
            if ic is not None:
                entry["icon_set"] = {
                    "name": ic.get("iconSet") or "3TrafficLights1",
                    "cfvo": [(v.get("type"), v.get("val")) for v in ic.findall(f"{_OOXML_MAIN}cfvo")],
                    "reverse": ic.get("reverse") == "1",
                }
            rules.append(entry)
    return rules


def _resolve_cfvo(vo_type, vo_val, values):
    """Resolve a <cfvo> threshold against a list of numeric values."""
    nums = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool)]
    if vo_type in ("min", "autoMin"):
        return min(nums) if nums else 0.0
    if vo_type in ("max", "autoMax"):
        return max(nums) if nums else 0.0
    try:
        val = float(vo_val)
    except (TypeError, ValueError):
        return min(nums) if nums else 0.0
    if vo_type == "percent":
        lo, hi = (min(nums), max(nums)) if nums else (0.0, 0.0)
        return lo + val / 100.0 * (hi - lo)
    if vo_type == "percentile":
        if not nums:
            return 0.0
        ordered = sorted(nums)
        k = (len(ordered) - 1) * val / 100.0
        f = int(k)
        c = min(f + 1, len(ordered) - 1)
        return ordered[f] + (ordered[c] - ordered[f]) * (k - f)
    return val  # num / formula (numeric constant)


def _lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    try:
        a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
        b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    except (ValueError, IndexError):
        return c1
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b))


_ICON_GLYPHS = {
    "3TrafficLights": [("●", "#E53935"), ("●", "#FDD835"), ("●", "#43A047")],
    "3Arrows": [("▼", "#E53935"), ("▬", "#FDD835"), ("▲", "#43A047")],
    "3Symbols": [("✖", "#E53935"), ("！", "#FB8C00"), ("✔", "#43A047")],
    "3Signs": [("◆", "#E53935"), ("▲", "#FDD835"), ("●", "#43A047")],
}


def _icon_glyphs(name):
    for key, glyphs in _ICON_GLYPHS.items():
        if name.startswith(key):
            return glyphs
    return _ICON_GLYPHS["3TrafficLights"]


def _cf_overrides_for_range(rules, dxfs, values_by_cell):
    """Evaluate CF rules -> {(col,row): {'bg','color','bold','italic','data_bar','icon_html'}}."""
    overrides = {}
    if not rules:
        return overrides

    def cells_of(rule):
        for (min_c, min_r, max_c, max_r) in rule["ranges"]:
            for r in range(min_r, max_r + 1):
                for c in range(min_c, max_c + 1):
                    yield c, r

    def range_values(rule):
        return [values_by_cell[k] for k in cells_of(rule) if k in values_by_cell]

    def apply_dxf(key, dxf_id):
        dxf = dxfs.get(dxf_id) if dxf_id is not None else None
        if not dxf:
            return
        cur = overrides.setdefault(key, {})
        for k in ("bg", "color", "bold", "italic"):
            if dxf.get(k) is not None:
                cur[k] = dxf[k]

    for rule in sorted(rules, key=lambda r: -r["priority"]):  # low priority first, high wins
        rtype = rule["type"]

        if rtype == "colorScale" and rule["color_scale"]:
            cs = rule["color_scale"]
            vals = range_values(rule)
            stops = [_resolve_cfvo(t, v, vals) for (t, v) in cs["cfvo"]]
            cols = [c for c in cs["colors"] if c]
            if len(stops) < 2 or len(cols) < 2:
                continue
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                if len(stops) >= 3 and len(cols) >= 3:
                    lo, mid, hi = stops[0], stops[1], stops[2]
                    if v <= mid:
                        span = mid - lo
                        color = _lerp_color(cols[0], cols[1], (v - lo) / span if span else 0.5)
                    else:
                        span = hi - mid
                        color = _lerp_color(cols[1], cols[2], (v - mid) / span if span else 0.5)
                else:
                    lo, hi = stops[0], stops[-1]
                    span = hi - lo
                    color = _lerp_color(cols[0], cols[-1], (v - lo) / span if span else 0.0)
                overrides.setdefault(key, {})["bg"] = color

        elif rtype == "dataBar" and rule["data_bar"]:
            db = rule["data_bar"]
            vals = range_values(rule)
            cfvo = db["cfvo"] or [("min", None), ("max", None)]
            lo = _resolve_cfvo(cfvo[0][0], cfvo[0][1], vals)
            hi = _resolve_cfvo(cfvo[-1][0], cfvo[-1][1], vals)
            span = hi - lo
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                frac = 0.0 if not span else max(0.0, min(1.0, (v - lo) / span))
                # Excel always shows a sliver of bar for in-range values
                pct = max(3, round(frac * 100)) if v >= lo else 0
                overrides.setdefault(key, {})["data_bar"] = (db["color"], pct)

        elif rtype == "iconSet" and rule["icon_set"]:
            ic = rule["icon_set"]
            vals = range_values(rule)
            glyphs = _icon_glyphs(ic["name"])
            if ic["reverse"]:
                glyphs = list(reversed(glyphs))
            cfvo = ic["cfvo"] or []
            stops = [_resolve_cfvo(t, v, vals) for (t, v) in cfvo][1:]  # drop the leading 0%/min
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                bucket = 0
                for j, s in enumerate(stops):
                    if v >= s:
                        bucket = j + 1
                bucket = min(bucket, len(glyphs) - 1)
                glyph, gcol = glyphs[bucket]
                overrides.setdefault(key, {})["icon_html"] = (
                    f'<span style="color:{gcol};">{glyph}</span>&nbsp;'
                )

        elif rtype == "cellIs":
            try:
                thresholds = [float(f) for f in rule["formulas"]]
            except (TypeError, ValueError):
                continue
            op = rule["operator"]
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                hit = (
                    (op == "greaterThan" and v > thresholds[0]) or
                    (op == "greaterThanOrEqual" and v >= thresholds[0]) or
                    (op == "lessThan" and v < thresholds[0]) or
                    (op == "lessThanOrEqual" and v <= thresholds[0]) or
                    (op == "equal" and v == thresholds[0]) or
                    (op == "notEqual" and v != thresholds[0]) or
                    (op == "between" and len(thresholds) > 1 and thresholds[0] <= v <= thresholds[1]) or
                    (op == "notBetween" and len(thresholds) > 1 and not (thresholds[0] <= v <= thresholds[1]))
                )
                if hit:
                    apply_dxf(key, rule["dxfId"])

        elif rtype in ("containsText", "notContainsText", "beginsWith", "endsWith", "equalText"):
            needle = (rule["text"] or "").lower()
            if not needle:
                continue
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if v is None:
                    continue
                s = str(v).lower()
                hit = (
                    (rtype == "containsText" and needle in s) or
                    (rtype == "notContainsText" and needle not in s) or
                    (rtype == "beginsWith" and s.startswith(needle)) or
                    (rtype == "endsWith" and s.endswith(needle)) or
                    (rtype == "equalText" and s == needle)
                )
                if hit:
                    apply_dxf(key, rule["dxfId"])

        elif rtype == "top10":
            nums = sorted((v for v in range_values(rule)
                           if isinstance(v, (int, float)) and not isinstance(v, bool)),
                          reverse=not rule["bottom"])
            if not nums:
                continue
            n = rule["rank"] or 10
            if rule["percent"]:
                n = max(1, round(len(nums) * n / 100.0))
            n = min(n, len(nums))
            cutoff = nums[n - 1]
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                if (not rule["bottom"] and v >= cutoff) or (rule["bottom"] and v <= cutoff):
                    apply_dxf(key, rule["dxfId"])

        elif rtype == "aboveAverage":
            nums = [v for v in range_values(rule)
                    if isinstance(v, (int, float)) and not isinstance(v, bool)]
            if not nums:
                continue
            mean = sum(nums) / len(nums)
            target = mean
            if rule["std_dev"]:
                var = sum((x - mean) ** 2 for x in nums) / len(nums)
                sd = var ** 0.5
                target = mean + rule["std_dev"] * sd * (1 if rule["above_average"] else -1)
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if not isinstance(v, (int, float)) or isinstance(v, bool):
                    continue
                if rule["above_average"]:
                    hit = v >= target if rule["equal_average"] else v > target
                else:
                    hit = v <= target if rule["equal_average"] else v < target
                if hit:
                    apply_dxf(key, rule["dxfId"])

        elif rtype in ("duplicateValues", "uniqueValues"):
            counts = {}
            for v in range_values(rule):
                counts[v] = counts.get(v, 0) + 1
            for key in cells_of(rule):
                v = values_by_cell.get(key)
                if v is None:
                    continue
                cnt = counts.get(v, 0)
                if (rtype == "duplicateValues" and cnt > 1) or (rtype == "uniqueValues" and cnt == 1):
                    apply_dxf(key, rule["dxfId"])

        # expression / timePeriod: skipped (needs a formula engine)

    return overrides


def _soffice_bin():
    return shutil.which("soffice") or shutil.which("libreoffice")


# LibreOffice startup dominates .xlsb conversion cost (~6-10s), so converted
# workbooks are cached for the process lifetime, keyed by file content hash.
# A whole campaign's files are converted up front in one soffice call via
# prewarm_xlsb_conversions(), so the per-recipient render just reads the cache.
_XLSB_CACHE_DIR = os.path.join(tempfile.gettempdir(), "as2_xlsb_cache")
_xlsb_cache: dict = {}
atexit.register(lambda: shutil.rmtree(_XLSB_CACHE_DIR, ignore_errors=True))


def _xlsb_key(file_path: str):
    """Content hash - so a re-uploaded copy of the same workbook (the preview
    endpoint writes a fresh temp file each call) reuses the conversion."""
    try:
        h = hashlib.md5()
        with open(file_path, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def prewarm_xlsb_conversions(file_paths):
    """Convert several .xlsb files to .xlsx in a single LibreOffice invocation
    and populate the cache. Safe to call with a mixed or empty list."""
    soffice = _soffice_bin()
    if not soffice:
        return
    pending = []
    for p in file_paths:
        if not p or not p.lower().endswith(".xlsb") or not os.path.exists(p):
            continue
        key = _xlsb_key(p)
        if key and key in _xlsb_cache and os.path.exists(_xlsb_cache[key]):
            continue
        pending.append(p)
    if not pending:
        return
    os.makedirs(_XLSB_CACHE_DIR, exist_ok=True)
    batch_dir = tempfile.mkdtemp(dir=_XLSB_CACHE_DIR)
    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "xlsx", "--outdir", batch_dir, *pending],
            capture_output=True, timeout=max(120, 20 * len(pending)), check=False,
        )
    except (subprocess.SubprocessError, OSError):
        return
    for p in pending:
        converted = os.path.join(batch_dir, os.path.splitext(os.path.basename(p))[0] + ".xlsx")
        key = _xlsb_key(p)
        if key and os.path.exists(converted):
            _xlsb_cache[key] = converted


def _converted_xlsx(file_path: str):
    """Return a cached/freshly-converted .xlsx path for a .xlsb file, or None."""
    key = _xlsb_key(file_path)
    if key and key in _xlsb_cache and os.path.exists(_xlsb_cache[key]):
        return _xlsb_cache[key]
    prewarm_xlsb_conversions([file_path])
    if key and key in _xlsb_cache and os.path.exists(_xlsb_cache[key]):
        return _xlsb_cache[key]
    return None


def get_cell_value(file_path: str, sheet_name: str, cell_ref: str) -> str:
    """Return the Excel-formatted display value of a single cell, for the
    {{Cell:Sheet!Ref}} campaign placeholder. Returns "" for any failure
    (missing sheet, bad address, CSV input, unreadable file) so a bad
    reference degrades to blank text rather than blocking the send."""
    lower = file_path.lower()
    if lower.endswith(".csv"):
        return ""
    work_path = file_path
    if lower.endswith(".xlsb"):
        work_path = _converted_xlsx(file_path)
        if not work_path:
            return ""
    try:
        wb = openpyxl.load_workbook(work_path, data_only=True, read_only=True)
        ws = _resolve_sheet(wb, sheet_name)
        cell = ws[cell_ref]
        return _format_cell_value(cell)
    except Exception:
        return ""


def render_excel_range_html(file_path: str, sheet_name: str, start_cell: str = ""):
    """Render the active range of ``sheet_name`` as an inline-styled HTML table
    that reproduces the source cell formatting (fills, fonts, borders,
    alignment, merged cells and number formats).

    Returns an HTML string, or ``None`` when exact rendering is not possible
    (CSV input, or a .xlsb when LibreOffice is not installed) so the caller can
    fall back to the plain data table.
    """
    lower = file_path.lower()
    if lower.endswith(".csv"):
        return None

    work_path = file_path
    if lower.endswith(".xlsb"):
        # .xlsb has no Python reader that exposes cell styles, so exact
        # rendering needs a LibreOffice conversion (cached; whole campaigns are
        # pre-converted in one call via prewarm_xlsb_conversions()).
        work_path = _converted_xlsx(file_path)
        if not work_path:
            return None

    wb = None
    try:
        # read-only load: streams the file, so a workbook with huge unrelated
        # data sheets (common after an .xlsb conversion) still opens fast.
        wb = openpyxl.load_workbook(work_path, data_only=True, read_only=True)
        ws = _resolve_sheet(wb, sheet_name)

        bounds = _detect_bounds(ws, start_cell or "")
        if not bounds:
            return None
        min_row, min_col, max_row, max_col = bounds

        # {{Summary}} is a summary block, not a data dump. Inline per-cell styles
        # are heavy, so clamp rows/cols to keep the email a sane size.
        MAX_ROWS, MAX_COLS = 150, 30
        truncated_rows = 0
        if max_row - min_row + 1 > MAX_ROWS:
            truncated_rows = max_row - (min_row + MAX_ROWS - 1)
            max_row = min_row + MAX_ROWS - 1
        if max_col - min_col + 1 > MAX_COLS:
            max_col = min_col + MAX_COLS - 1

        # Merged ranges (from the zip - read-only mode hides them), clamped to
        # the visible window.
        anchors = {}
        covered = set()
        for ref in _merged_ranges(work_path, ws.title):
            try:
                m_min_col, m_min_row, m_max_col, m_max_row = openpyxl.utils.range_boundaries(ref)
            except (ValueError, TypeError):
                continue
            if m_max_row < min_row or m_min_row > max_row or m_max_col < min_col or m_min_col > max_col:
                continue
            a_row, a_col = max(m_min_row, min_row), max(m_min_col, min_col)
            c_max_row, c_max_col = min(m_max_row, max_row), min(m_max_col, max_col)
            anchors[(a_row, a_col)] = (c_max_row - a_row + 1, c_max_col - a_col + 1)
            for rr in range(a_row, c_max_row + 1):
                for cc in range(a_col, c_max_col + 1):
                    if (rr, cc) != (a_row, a_col):
                        covered.add((rr, cc))

        # Conditional formatting (colour scales, cellIs, data bars, icon sets,
        # top10/aboveAverage, text rules). openpyxl's read-only mode cannot see
        # CF, so it is read from the zip XML and evaluated here.
        cf_overrides = {}
        try:
            cf_rules = _read_conditional_formatting(work_path, ws.title)
            clamped = []
            for rule in cf_rules:
                rule["ranges"] = [
                    (max(mc, min_col), max(mr, min_row), min(xc, max_col), min(xr, max_row))
                    for (mc, mr, xc, xr) in rule["ranges"]
                    if not (xr < min_row or mr > max_row or xc < min_col or mc > max_col)
                ]
                if rule["ranges"]:
                    clamped.append(rule)
            if clamped:
                dxfs = _read_dxfs(work_path)
                values_by_cell = {}
                for rr, vrow in enumerate(ws.iter_rows(min_row=min_row, max_row=max_row,
                                                       min_col=min_col, max_col=max_col),
                                          start=min_row):
                    for cc, vcell in enumerate(vrow, start=min_col):
                        if vcell.value is not None:
                            values_by_cell[(cc, rr)] = vcell.value
                cf_overrides = _cf_overrides_for_range(clamped, dxfs, values_by_cell)
        except Exception as cf_err:  # noqa: BLE001 - CF is best-effort
            print(f"conditional formatting skipped: {cf_err}")

        # Auto table layout (no fixed widths) - reproduces the Excel colours,
        # fonts, borders, alignment and number formats while letting the table
        # size itself to its content, which renders consistently across mail
        # clients.
        out = [
            '<table role="presentation" cellspacing="0" cellpadding="0" '
            'style="border-collapse:collapse;'
            'font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#000000;'
            'line-height:1.2;">'
        ]

        SIZE_BUDGET = 400 * 1024  # keep the summary well under mail-client limits
        running_len = 0
        stopped_at = None
        for r, row in enumerate(ws.iter_rows(min_row=min_row, max_row=max_row,
                                             min_col=min_col, max_col=max_col),
                                start=min_row):
            row_html = ["<tr>"]
            for c, cell in enumerate(row, start=min_col):
                if (r, c) in covered:
                    continue
                attrs = ""
                span = anchors.get((r, c))
                if span:
                    rs, cs = span
                    if rs > 1:
                        attrs += f' rowspan="{rs}"'
                    if cs > 1:
                        attrs += f' colspan="{cs}"'
                ov = cf_overrides.get((c, r))
                text = html_lib.escape(_format_cell_value(cell)).replace("\n", "<br>")
                if ov and ov.get("icon_html"):
                    text = ov["icon_html"] + (text if text else "")
                elif not text:
                    text = "&nbsp;"
                if ov and ov.get("data_bar"):
                    bar_color, pct = ov["data_bar"]
                    base_color = _fill_to_css(cell.fill) or "#FFFFFF"
                    text = _data_bar_html(text, bar_color, pct, base_color)
                elif not ov and _is_percent_cell(cell):
                    # No conditional formatting on this cell in the source file,
                    # but it's a percentage - add a bar automatically like v1 did,
                    # instead of only reproducing bars Excel's own CF rules define.
                    pct = cell.value * 100
                    text = _data_bar_html(text, _auto_bar_color(pct), pct, "#EDEDED")
                row_html.append(f'<td{attrs} style="{_cell_css(cell, ov)}">{text}</td>')
            row_html.append("</tr>")
            joined = "".join(row_html)
            running_len += len(joined)
            out.append(joined)
            if running_len > SIZE_BUDGET and r < max_row:
                stopped_at = r
                break

        out.append("</table>")
        if stopped_at is not None:
            truncated_rows += max_row - stopped_at
        if truncated_rows:
            out.append(
                f'<p style="font-family:Calibri,Arial,sans-serif;font-size:10pt;'
                f'color:#666666;margin:4px 0 0;">… {truncated_rows} more row(s) not shown</p>'
            )
        return "".join(out)
    except Exception as e:  # noqa: BLE001 - fall back to the plain data table
        print(f"render_excel_range_html failed: {e}")
        return None
    finally:
        if wb is not None:
            wb.close()


# ---------------------------------------------------------------------------
# Image rendering: let LibreOffice draw the range so the picture is a
# pixel-exact copy of the Excel sheet (conditional formatting, fonts, icons and
# formula-based rules all included). xlsx -> (print-prepped) xlsx -> pdf -> png.
# ---------------------------------------------------------------------------

_SUMMARY_IMG_CACHE_DIR = os.path.join(tempfile.gettempdir(), "as2_summary_img")
_summary_image_cache: dict = {}
atexit.register(lambda: shutil.rmtree(_SUMMARY_IMG_CACHE_DIR, ignore_errors=True))


def _img_key(file_path: str, sheet_name: str, start_cell: str):
    h = _xlsb_key(file_path) if file_path.lower().endswith(".xlsb") else None
    if h is None:
        try:
            digest = hashlib.md5()
            with open(file_path, "rb") as fh:
                for chunk in iter(lambda: fh.read(1 << 20), b""):
                    digest.update(chunk)
            h = digest.hexdigest()
        except OSError:
            return None
    return f"{h}:{sheet_name}:{start_cell}"


def _prep_print_xlsx(src_xlsx: str, sheet_name: str, start_cell: str, dest_xlsx: str):
    """Load the workbook, keep only the target sheet, size its columns to fit the
    detected range, set a tight single-page print area, and save to dest."""
    wb = openpyxl.load_workbook(src_xlsx, data_only=True)
    try:
        title = sheet_name if sheet_name in wb.sheetnames else None
        if title is None:
            target = (sheet_name or "").strip().lower()
            title = next((n for n in wb.sheetnames if n.strip().lower() == target), wb.sheetnames[0])
        for other in list(wb.sheetnames):
            if other != title:
                del wb[other]
        ws = wb[title]

        bounds = _detect_bounds(ws, start_cell or "")
        if not bounds:
            return None
        min_row, min_col, max_row, max_col = bounds
        max_row = min(max_row, min_row + 400)
        max_col = min(max_col, min_col + 40)

        for c in range(min_col, max_col + 1):
            letter = openpyxl.utils.get_column_letter(c)
            widest = 0
            for r in range(min_row, max_row + 1):
                v = ws.cell(row=r, column=c).value
                if v is not None:
                    widest = max(widest, len(str(v)))
            ws.column_dimensions[letter].width = max(9.0, min(widest * 1.15 + 3, 70.0))

        ref = (f"{openpyxl.utils.get_column_letter(min_col)}{min_row}:"
               f"{openpyxl.utils.get_column_letter(max_col)}{max_row}")
        ws.print_area = ref
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.page_setup.fitToHeight = 1
        ws.sheet_properties.pageSetUpPr.fitToPage = True
        ws.print_options.gridLines = False
        ws.print_options.headings = False
        for side in ("left", "right", "top", "bottom"):
            setattr(ws.page_margins, side, 0.1)
        wb.save(dest_xlsx)
        return ref
    finally:
        wb.close()


def _pdf_page_to_png(pdf_path: str):
    import pymupdf  # local import; heavy module, only needed for image mode
    doc = pymupdf.open(pdf_path)
    try:
        page = doc[0]
        bbox = None
        for block in page.get_text("blocks"):
            r = pymupdf.Rect(block[:4])
            bbox = r if bbox is None else bbox | r
        for drawing in page.get_drawings():
            r = drawing["rect"]
            bbox = r if bbox is None else bbox | r
        if bbox is None or bbox.is_empty:
            bbox = page.rect
        margin = 4
        clip = pymupdf.Rect(bbox.x0 - margin, bbox.y0 - margin,
                            bbox.x1 + margin, bbox.y1 + margin) & page.rect
        pix = page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=clip)
        return pix.tobytes("png")
    finally:
        doc.close()


def prewarm_summary_images(file_paths, sheet_name: str, start_cell: str = ""):
    """Print-prep each file then convert them all to PDF in one LibreOffice call
    (soffice startup dominates); PNGs are rasterised lazily and cached."""
    soffice = _soffice_bin()
    if not soffice:
        return
    os.makedirs(_SUMMARY_IMG_CACHE_DIR, exist_ok=True)
    batch_dir = tempfile.mkdtemp(dir=_SUMMARY_IMG_CACHE_DIR)
    prepped = []  # (cache_key, prepped_xlsx_path)
    for p in file_paths:
        if not p or not os.path.exists(p) or p.lower().endswith(".csv"):
            continue
        key = _img_key(p, sheet_name, start_cell)
        if not key or key in _summary_image_cache:
            continue
        src = p
        if p.lower().endswith(".xlsb"):
            src = _converted_xlsx(p)
            if not src:
                continue
        stem = f"s{len(prepped)}"
        dest = os.path.join(batch_dir, stem + ".xlsx")
        try:
            if _prep_print_xlsx(src, sheet_name, start_cell, dest):
                prepped.append((key, dest))
        except Exception as e:  # noqa: BLE001
            print(f"summary image prep failed for {p}: {e}")
    if not prepped:
        return
    try:
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", batch_dir,
             *[d for _, d in prepped]],
            capture_output=True, timeout=max(120, 20 * len(prepped)), check=False,
        )
    except (subprocess.SubprocessError, OSError):
        return
    for key, dest in prepped:
        pdf = os.path.splitext(dest)[0] + ".pdf"
        if not os.path.exists(pdf):
            continue
        try:
            png = _pdf_page_to_png(pdf)
            out_png = os.path.splitext(dest)[0] + ".png"
            with open(out_png, "wb") as fh:
                fh.write(png)
            _summary_image_cache[key] = out_png
        except Exception as e:  # noqa: BLE001
            print(f"summary image rasterise failed: {e}")


def render_excel_range_image(file_path: str, sheet_name: str, start_cell: str = ""):
    """Return PNG bytes of the range as LibreOffice draws it, or ``None`` on any
    failure (caller falls back to the HTML table)."""
    if file_path.lower().endswith(".csv"):
        return None
    key = _img_key(file_path, sheet_name, start_cell)
    if key and key in _summary_image_cache and os.path.exists(_summary_image_cache[key]):
        try:
            with open(_summary_image_cache[key], "rb") as fh:
                return fh.read()
        except OSError:
            pass
    prewarm_summary_images([file_path], sheet_name, start_cell)
    if key and key in _summary_image_cache and os.path.exists(_summary_image_cache[key]):
        try:
            with open(_summary_image_cache[key], "rb") as fh:
                return fh.read()
        except OSError:
            return None
    return None
