#!/usr/bin/env python3
"""Build detailed procedure data and one downloadable PDF per formula."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from collections import defaultdict
from html import escape
from pathlib import Path

import pdfplumber
from PIL import Image
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
FORMULAS_PATH = ROOT / "app" / "data" / "formulas.json"
SOURCE_NOTES_PATH = ROOT / "app" / "data" / "formula-source-notes.json"
PROCEDURES_PATH = ROOT / "app" / "data" / "formula-procedures.json"
OUTPUT_DIR = ROOT / "public" / "formulas"
PACKED_DIR = ROOT / "public" / "packed"
LOGO_PATH = ROOT / "public" / "catalog" / "sapharchem-logo.png"

BLUE = colors.HexColor("#026690")
ORANGE = colors.HexColor("#EF6F32")
INK = colors.HexColor("#181818")
PALE_BLUE = colors.HexColor("#EAF5F8")
PALE_ORANGE = colors.HexColor("#FFF0E8")
LINE = colors.HexColor("#D9DDDE")
MUTED = colors.HexColor("#697178")

rl_config.invariant = 1

SOLUTION_IMAGES = {
    "solution-moisture": "hydration-recovery.webp",
    "solution-brightening": "brightening-antiaging.webp",
    "solution-antiaging": "brightening-antiaging.webp",
    "solution-soothing": "hydration-recovery.webp",
    "solution-exfoliation": "cleansing-acne.webp",
    "solution-acne": "cleansing-acne.webp",
    "solution-sun": "sun-makeup.webp",
    "solution-cleansing": "cleansing-acne.webp",
    "solution-hair": "hair-scalp.webp",
    "solution-lip": "sun-makeup.webp",
    "solution-intimate": "personal-care.webp",
    "solution-oral": "personal-care.webp",
    "solution-base": "personal-care.webp",
}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").replace("\uf0b0", "°")).strip()


def normalize_phase(value: object) -> str:
    phase = clean(value).upper()
    match = re.match(r"([A-Z](?:\d)?)", phase)
    return match.group(1) if match else (phase or "-")


def insert_common_spacing(text: str) -> str:
    replacements = [
        ("Quytrìnhphốichế", "Quy trình phối chế"),
        ("Chuẩnbị", "Chuẩn bị "), ("chuẩnbị", "chuẩn bị "),
        ("gianhiệt", "gia nhiệt "), ("Gianhiệt", "Gia nhiệt "),
        ("hạnhiệt", "hạ nhiệt "), ("Hạnhiệt", "Hạ nhiệt "),
        ("đồnghóa", "đồng hóa "), ("Đồnghóa", "Đồng hóa "),
        ("khuấyđều", "khuấy đều "), ("Khuấyđều", "Khuấy đều "),
        ("khuấytan", "khuấy tan "), ("Khuấytan", "Khuấy tan "),
        ("trươngnở", "trương nở "), ("hoàntoàn", "hoàn toàn "),
        ("đếnkhi", "đến khi "), ("trongcốcriêng", "trong cốc riêng "),
        ("vàohệ", "vào hệ "), ("vàopha", "vào pha "),
        ("cholầnlượt", "cho lần lượt "), ("Cho dầnB", "Cho dần B"),
        ("Sauđó", "Sau đó, "), ("sauđó", "sau đó, "),
        ("thêmB", "thêm B"), ("thêmC", "thêm C"), ("thêmD", "thêm D"),
        ("thêmE", "thêm E"), ("phaA", "pha A"), ("phaB", "pha B"),
        ("phaC", "pha C"), ("phaD", "pha D"), ("phaE", "pha E"),
        ("rpmtrong", " rpm trong "), ("phút.", " phút."),
        ("điềuchỉnh", "điều chỉnh "), ("nếucần", "nếu cần"),
        ("p H", "pH"), ("P H", "pH"), ("° C", "°C"),
    ]
    for source, target in replacements:
        text = text.replace(source, target)
    text = re.sub(r"(?<=[a-zà-ỹ])(?=[A-ZĐ])", " ", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace("p H", "pH").replace("P H", "pH").replace("° C", "°C")
    text = re.sub(r"\s+([,.;:)])", r"\1", text)
    text = re.sub(r"([(])\s+", r"\1", text)
    return text.strip(" -\n")


def extract_numbered_steps(text: str) -> list[str]:
    marker = re.search(r"quy\s*tr[ìi]nh\s*ph[ốo]i\s*ch[ếe]\s*:|procedure\s*:|process\s*:", text, re.I)
    if not marker:
        return []
    segment = text[marker.end():]
    end = re.search(r"t[íi]nh\s*ch[ấa]t|product\s*propert|characteristic|stability", segment, re.I)
    if end:
        segment = segment[: end.start()]
    matches = list(re.finditer(r"(?m)(?:^|\n)\s*(\d{1,2})[.)]\s*", segment))
    steps: list[str] = []
    for index, match in enumerate(matches):
        end_at = matches[index + 1].start() if index + 1 < len(matches) else len(segment)
        value = insert_common_spacing(segment[match.end():end_at])
        value = re.sub(r"\b\d+(?:[.,]\d+)?\s*$", "", value).strip()
        if 5 <= len(value) <= 850:
            steps.append(value)
    return steps[:12]


def extract_source_notes(formulas: list[dict], source_root: Path) -> dict[str, list[str]]:
    file_index: dict[str, list[Path]] = defaultdict(list)
    for path in source_root.rglob("*"):
        if path.is_file():
            file_index[path.name].append(path)
    notes: dict[str, list[str]] = {}
    for formula in formulas:
        if formula.get("sourceType") != "PDF":
            continue
        candidates = file_index.get(formula.get("sourceFile", ""), [])
        if not candidates:
            continue
        try:
            with pdfplumber.open(candidates[0]) as pdf:
                page_width = int(pdf.pages[0].width)
                page_height = int(pdf.pages[0].height)
            crop_x = int(page_width * 0.60)
            command = subprocess.run(
                ["pdftotext", "-layout", "-x", str(crop_x), "-y", "0", "-W", str(page_width - crop_x), "-H", str(page_height), str(candidates[0]), "-"],
                check=True,
                capture_output=True,
                text=True,
            )
            steps = extract_numbered_steps(command.stdout)
            if not steps:
                with pdfplumber.open(candidates[0]) as pdf:
                    fragments = []
                    for page in pdf.pages:
                        fragments.append(page.crop((page.width * 0.55, 0, page.width, page.height)).extract_text() or "")
                steps = extract_numbered_steps("\n".join(fragments))
            contaminated = re.compile(r"\b\d+(?:[.,]\d{2})\b|\b(?:en/HQ|%\s*w/w|Tổng cộng|Tính chất sản phẩm)\b", re.I)
            if any(contaminated.search(step) for step in steps):
                steps = []
            if steps:
                notes[formula["id"]] = steps
        except Exception:
            continue
    return notes


def formula_type(formula: dict) -> str:
    title = clean(formula.get("title")).lower()
    text = " ".join(clean(item.get("inci")) + " " + clean(item.get("function")) for item in formula["ingredients"]).lower()
    has_water = bool(re.search(r"\b(water|aqua|demineralized water)\b", text))
    if any(term in title for term in ["lipstick", "lip balm", "stick"]) or (not has_water and any(term in text for term in ["wax", "beeswax", "ozokerite"])):
        return "Hệ khan / hot-pour"
    if any(term in title for term in ["shampoo", "wash", "cleanser", "shower", "toothpaste", "feminine"]):
        return "Hệ làm sạch chứa chất hoạt động bề mặt"
    if any(term in title for term in ["cream", "lotion", "conditioner", "sunscreen", "bb ", "emulsion"]):
        return "Hệ nhũ tương"
    if any(term in title for term in ["gel", "serum", "toner", "spray", "ampoule", "mask"]):
        return "Hệ nước / gel"
    return "Hệ phối chế đa dụng"


def phase_groups(formula: dict) -> list[tuple[str, list[dict]]]:
    grouped: dict[str, list[dict]] = {}
    order: list[str] = []
    for item in formula["ingredients"]:
        phase = normalize_phase(item.get("phase"))
        if phase not in grouped:
            grouped[phase] = []
            order.append(phase)
        grouped[phase].append(item)
    return [(phase, grouped[phase]) for phase in order]


def item_names(items: list[dict]) -> str:
    names = [clean(item.get("tradeName")) for item in items if clean(item.get("tradeName")) not in {"", "-"}]
    if not names:
        names = [clean(item.get("inci")) for item in items if clean(item.get("inci"))]
    result = ", ".join(names[:5])
    if len(names) > 5:
        result += f" và {len(names) - 5} thành phần khác"
    return result or "các thành phần của pha"


def temperature_from(text: str, fallback: str) -> str:
    values = re.findall(r"\b(\d{2,3})\s*°?\s*C\b", text, re.I)
    return " / ".join(dict.fromkeys(f"{value}°C" for value in values)) if values else fallback


def speed_from(text: str, fallback: str) -> str:
    values = re.findall(r"\b(\d{3,5}(?:\s*[-–]\s*\d{3,5})?)\s*rpm\b", text, re.I)
    return " / ".join(dict.fromkeys(f"{value} rpm" for value in values)) if values else fallback


def make_step(number: int, title: str, phase: str, instruction: str, temperature: str, mixing: str, control: str) -> dict:
    return {
        "number": number,
        "title": title,
        "phase": phase,
        "instruction": clean(instruction),
        "temperature": temperature,
        "mixing": mixing,
        "control": control,
    }


def derive_procedure(formula: dict, source_steps: list[str]) -> dict:
    system = formula_type(formula)
    groups = phase_groups(formula)
    all_text = " ".join(clean(item.get("inci")) + " " + clean(item.get("function")) for item in formula["ingredients"]).lower()
    is_emulsion = system == "Hệ nhũ tương"
    is_surfactant = system == "Hệ làm sạch chứa chất hoạt động bề mặt"
    is_anhydrous = system == "Hệ khan / hot-pour"
    steps = [make_step(
        1,
        "Chuẩn bị",
        "Tất cả pha",
        "Vệ sinh thiết bị, hiệu chuẩn cân và chuẩn bị riêng từng pha theo bảng công thức. Cân chính xác từng nguyên liệu; rây bột hoặc phá vón trước khi đưa vào hệ.",
        "25 ± 3°C",
        "Khuấy chậm khi nạp liệu",
        "Thiết bị sạch, khô; nguyên liệu đúng mã và khối lượng.",
    )]

    if source_steps:
        for source in source_steps:
            steps.append(make_step(
                len(steps) + 1,
                f"Phối chế - bước {len(steps)}",
                "Theo file gốc",
                source,
                temperature_from(source, "Theo dõi nhiệt độ hệ"),
                speed_from(source, "Khuấy đủ để đồng nhất"),
                "Kiểm tra độ đồng nhất trước khi chuyển bước.",
            ))
    else:
        for phase, items in groups:
            phase_text = " ".join(clean(item.get("inci")) + " " + clean(item.get("function")) for item in items).lower()
            names = item_names(items)
            contains_powder = bool(re.search(r"titanium|zinc oxide|mica|talc|powder|bột|pigment", phase_text))
            contains_surfactant = bool(re.search(r"glucoside|betaine|sarcosinate|sulfate|surfactant|hoạt động bề mặt|hđbm", phase_text))
            contains_active = bool(re.search(r"extract|peptide|hyaluron|vitamin|fragrance|preserv|chiết xuất|hoạt chất|bảo quản", phase_text))
            contains_oil = bool(re.search(r"oil|wax|butter|ester|triglyceride|emuls|dầu|sáp|nhũ", phase_text))
            if contains_powder:
                instruction = f"Premix {names} với phần chất mang phù hợp của pha {phase}; phân tán từ từ và đồng hóa đến khi không còn hạt vón hoặc vệt màu."
                temperature, mixing, control = "25-45°C", "2.500-3.500 rpm, 3-5 phút", "Phân tán mịn, màu đồng nhất, không vón."
            elif contains_surfactant or is_surfactant:
                instruction = f"Cho lần lượt {names} của pha {phase} vào nồi chính. Khuấy chậm, hạn chế cuốn khí; chỉ tăng tốc sau khi mỗi thành phần đã tan hoặc phân tán hoàn toàn."
                temperature, mixing, control = "25-40°C", "300-500 rpm", "Hệ đồng nhất, bọt được kiểm soát."
            elif contains_oil and is_emulsion:
                instruction = f"Chuẩn bị pha dầu {phase}: phối hợp {names}, gia nhiệt và khuấy đến khi chất rắn nóng chảy hoàn toàn, pha trong và đồng nhất."
                temperature, mixing, control = "70-80°C", "500-800 rpm", "Không còn sáp hoặc chất rắn chưa tan."
            elif contains_active:
                instruction = f"Chuẩn bị riêng pha {phase} gồm {names}. Hòa tan hoặc phân tán nhẹ nhàng; bổ sung vào hệ khi đã hạ dưới nhiệt độ phù hợp với hoạt chất."
                temperature, mixing, control = "≤ 40°C", "300-500 rpm", "Không đổi màu, không kết tủa."
            else:
                instruction = f"Chuẩn bị pha {phase}: cho lần lượt {names}, khuấy đến khi tan hoặc phân tán hoàn toàn trước khi chuyển sang pha tiếp theo."
                temperature, mixing, control = ("70-75°C" if is_emulsion else "25-40°C"), "500-800 rpm", "Pha đồng nhất, không còn hạt chưa tan."
            steps.append(make_step(len(steps) + 1, f"Chuẩn bị pha {phase}", f"Pha {phase}", instruction, temperature, mixing, control))

        if is_emulsion:
            direction = "cho từ từ pha dầu vào pha nước" if "w/o" not in clean(formula.get("title")).lower() else "cho từ từ pha nước vào pha dầu"
            steps.append(make_step(
                len(steps) + 1,
                "Nhũ hóa",
                "Pha chính",
                f"Khi hai pha đạt nhiệt độ tương đương, {direction} dưới khuấy. Đồng hóa đến khi hệ mịn, sau đó chuyển sang khuấy cánh quét trong khi hạ nhiệt.",
                "70-75°C",
                "2.500-4.000 rpm trong 3-8 phút; sau đó 500-800 rpm",
                "Nhũ mịn, không tách lớp, không còn vệt dầu.",
            ))
        elif is_anhydrous:
            steps.append(make_step(
                len(steps) + 1,
                "Hoàn thiện hệ nóng chảy",
                "Pha chính",
                "Duy trì khuấy đến khi khối nóng chảy đồng nhất. Giảm tốc để thoát bọt, sau đó rót nóng vào bao bì hoặc khuôn đã chuẩn bị.",
                "75-85°C khi phối; rót ở 65-75°C",
                "300-500 rpm",
                "Khối đồng nhất, bề mặt sau đông rắn không rỗ hoặc nứt.",
            ))

    steps.append(make_step(
        len(steps) + 1,
        "Hiệu chỉnh và hoàn tất",
        "Thành phẩm",
        "Kiểm tra và hiệu chỉnh pH nếu công thức yêu cầu. Bù lượng hao hụt bằng pha nền, khuấy đồng nhất, khử bọt và lấy mẫu kiểm tra trước khi chiết rót.",
        "25-35°C",
        "200-400 rpm; khử bọt ở tốc độ thấp",
        "Ngoại quan đồng nhất; pH, độ nhớt và khối lượng đạt tiêu chuẩn nội bộ.",
    ))

    if "pH" not in all_text:
        note = "Quy trình chi tiết được chuẩn hóa theo cấu trúc pha và loại hệ; cần xác nhận pH mục tiêu, thiết bị và quy mô trước khi scale-up."
    else:
        note = "Điều chỉnh tốc độ và thời gian theo thiết bị thực tế; xác nhận độ ổn định trước khi scale-up."
    return {"systemType": system, "basis": "source" if source_steps else "derived", "steps": steps, "note": note}


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("SPC", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("SPC-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))


def draw_rounded_image(canvas, path: Path, x: float, y: float, width: float, height: float, radius: float = 14) -> None:
    canvas.saveState()
    clip = canvas.beginPath()
    clip.roundRect(x, y, width, height, radius)
    canvas.clipPath(clip, stroke=0, fill=0)
    image = Image.open(path)
    iw, ih = image.size
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    canvas.drawImage(str(path), x - (dw - width) / 2, y - (dh - height) / 2, dw, dh, preserveAspectRatio=True, mask="auto")
    canvas.restoreState()


def page_decor(canvas, doc) -> None:
    canvas.saveState()
    if LOGO_PATH.exists():
        canvas.drawImage(str(LOGO_PATH), A4[0] - 43 * mm, A4[1] - 16 * mm, 23 * mm, 12 * mm, preserveAspectRatio=True, mask="auto")
    canvas.setStrokeColor(LINE)
    canvas.line(20 * mm, 13 * mm, A4[0] - 20 * mm, 13 * mm)
    canvas.setFont("SPC", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 8.5 * mm, "SPC FORMULA SHEET")
    canvas.drawRightString(A4[0] - 20 * mm, 8.5 * mm, f"{doc.page:02d}")
    canvas.restoreState()


def styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("TitleSPC", parent=base["Title"], fontName="SPC-Bold", fontSize=23, leading=27, textColor=INK),
        "meta": ParagraphStyle("MetaSPC", parent=base["BodyText"], fontName="SPC", fontSize=8.5, leading=12, textColor=MUTED),
        "h2": ParagraphStyle("H2SPC", parent=base["Heading2"], fontName="SPC-Bold", fontSize=16, leading=20, textColor=INK, spaceAfter=4 * mm),
        "body": ParagraphStyle("BodySPC", parent=base["BodyText"], fontName="SPC", fontSize=8.2, leading=11, textColor=INK),
        "small": ParagraphStyle("SmallSPC", parent=base["BodyText"], fontName="SPC", fontSize=7, leading=9, textColor=MUTED),
        "bold": ParagraphStyle("BoldSPC", parent=base["BodyText"], fontName="SPC-Bold", fontSize=8.2, leading=11, textColor=INK),
        "step_title": ParagraphStyle("StepTitle", parent=base["BodyText"], fontName="SPC-Bold", fontSize=10, leading=13, textColor=BLUE),
    }


def formula_pdf(formula: dict, procedure: dict, output: Path, solution_titles: dict[str, str], image_dir: Path) -> None:
    sheet = styles()
    doc = SimpleDocTemplate(
        str(output), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=18 * mm, title=clean(formula.get("title")), author="Sapharchem",
        subject="SPC HPC formulation and manufacturing procedure",
    )
    story = []
    image_path = image_dir / (Path(SOLUTION_IMAGES.get(formula.get("solutionId"), "personal-care.webp")).stem + ".jpg")
    if image_path.exists():
        from reportlab.platypus import Flowable
        class Hero(Flowable):
            def __init__(self): super().__init__(); self.width = 169 * mm; self.height = 48 * mm
            def draw(self): draw_rounded_image(self.canv, image_path, 0, 0, self.width, self.height, 16)
        story.extend([Hero(), Spacer(1, 7 * mm)])
    story.extend([
        Paragraph(escape(clean(formula.get("title"))), sheet["title"]),
        Paragraph(
            f"{escape(clean(formula.get('code')) or 'Prototype')} &nbsp; | &nbsp; {formula.get('year') or '-'} &nbsp; | &nbsp; "
            f"{escape(solution_titles.get(formula.get('solutionId'), 'Packed Solution'))} &nbsp; | &nbsp; {escape(procedure['systemType'])}",
            sheet["meta"],
        ),
        Spacer(1, 6 * mm),
        Paragraph("THÀNH PHẦN CÔNG THỨC", sheet["h2"]),
    ])
    rows = [[Paragraph("PHA", sheet["bold"]), Paragraph("TÊN THƯƠNG MẠI", sheet["bold"]), Paragraph("INCI", sheet["bold"]), Paragraph("CHỨC NĂNG", sheet["bold"]), Paragraph("%", sheet["bold"])]]
    for item in formula["ingredients"]:
        rows.append([
            Paragraph(escape(clean(item.get("phase")) or "-"), sheet["bold"]),
            Paragraph(escape(clean(item.get("tradeName")) or "-"), sheet["bold"]),
            Paragraph(escape(clean(item.get("inci")) or "-"), sheet["body"]),
            Paragraph(escape(clean(item.get("function")) or "-"), sheet["body"]),
            Paragraph(escape(clean(item.get("percentage")) or "-"), sheet["bold"]),
        ])
    table = LongTable(rows, colWidths=[12 * mm, 38 * mm, 56 * mm, 49 * mm, 14 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ] + [("BACKGROUND", (0, row), (-1, row), colors.HexColor("#F7F8F7")) for row in range(2, len(rows), 2)]))
    story.extend([table, PageBreak(), Paragraph("QUY TRÌNH PHỐI CHẾ CHI TIẾT", sheet["h2"])])
    for step in procedure["steps"]:
        meta = f"{escape(step['phase'])} &nbsp; | &nbsp; {escape(step['temperature'])} &nbsp; | &nbsp; {escape(step['mixing'])}"
        card = Table([[
            Paragraph(f"{step['number']:02d}", sheet["step_title"]),
            [Paragraph(escape(step["title"]), sheet["step_title"]), Paragraph(meta, sheet["small"]), Spacer(1, 2 * mm), Paragraph(escape(step["instruction"]), sheet["body"]), Spacer(1, 2 * mm), Paragraph(f"<b>Điểm kiểm soát:</b> {escape(step['control'])}", sheet["small"])],
        ]], colWidths=[13 * mm, 151 * mm])
        card.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, 0), PALE_ORANGE), ("BACKGROUND", (1, 0), (1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.extend([KeepTogether(card), Spacer(1, 3 * mm)])
    story.extend([Spacer(1, 2 * mm), Table([[Paragraph(f"<b>Lưu ý:</b> {escape(procedure['note'])}", sheet["body"])]], colWidths=[169 * mm], style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), PALE_BLUE), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#B8D9E5")), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))])
    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)


def main() -> None:
    register_fonts()
    formulas_payload = json.loads(FORMULAS_PATH.read_text(encoding="utf-8"))
    formulas = formulas_payload["formulas"]
    source_root_value = os.environ.get("FORMULA_SOURCE_DIR", "").strip()
    if source_root_value and Path(source_root_value).exists():
        source_notes = extract_source_notes(formulas, Path(source_root_value))
        SOURCE_NOTES_PATH.write_text(json.dumps(source_notes, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        source_notes = json.loads(SOURCE_NOTES_PATH.read_text(encoding="utf-8")) if SOURCE_NOTES_PATH.exists() else {}

    procedures = {formula["id"]: derive_procedure(formula, source_notes.get(formula["id"], [])) for formula in formulas}
    PROCEDURES_PATH.write_text(json.dumps({"meta": {"formulaCount": len(formulas), "sourceBasedCount": sum(1 for value in procedures.values() if value["basis"] == "source")}, "procedures": procedures}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    solution_titles = {item["id"]: item["title"] for item in formulas_payload["solutions"]}
    image_dir = ROOT / ".formula-pdf-cache"
    if image_dir.exists():
        shutil.rmtree(image_dir)
    image_dir.mkdir(parents=True)
    try:
        for filename in set(SOLUTION_IMAGES.values()) | {"personal-care.webp"}:
            source = PACKED_DIR / filename
            if not source.exists():
                continue
            with Image.open(source) as image:
                image = image.convert("RGB")
                image.thumbnail((800, 500), Image.Resampling.LANCZOS)
                image.save(image_dir / (Path(filename).stem + ".jpg"), quality=58, optimize=True, progressive=True)
        for formula in formulas:
            formula_pdf(formula, procedures[formula["id"]], OUTPUT_DIR / f"{formula['id']}.pdf", solution_titles, image_dir)
    finally:
        shutil.rmtree(image_dir, ignore_errors=True)
    print(json.dumps({"formulaCount": len(formulas), "sourceBasedCount": sum(1 for value in procedures.values() if value["basis"] == "source"), "pdfCount": len(list(OUTPUT_DIR.glob("*.pdf")))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
