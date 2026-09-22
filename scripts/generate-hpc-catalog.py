#!/usr/bin/env python3
"""Generate the downloadable SPC HPC portfolio from the Site catalog data."""

from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from html import escape
from datetime import datetime
from zoneinfo import ZoneInfo

from PIL import Image
from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    LongTable,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.utils import ImageReader


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CATALOG_PATH = os.path.join(ROOT, "app", "data", "catalog.json")
ASSET_DIR = os.path.join(ROOT, "public", "catalog")
OUTPUT_PATH = os.path.join(ASSET_DIR, "SPC-HPC-Catalog-2026.pdf")
LOGO_SOURCE = os.path.join(ROOT, "scripts", "assets", "sapharchem-logo-source.png")
LOGO_PATH = os.path.join(ASSET_DIR, "sapharchem-logo.png")
PACKED_DIR = os.path.join(ROOT, "public", "packed")
COVER_IMAGE = os.path.join(ROOT, "scripts", "assets", "hpc-catalog-cover.png")

PAGE_W, PAGE_H = A4
MARGIN_X = 20 * mm
TOP_MARGIN = 22 * mm
BOTTOM_MARGIN = 18 * mm

INK = colors.HexColor("#171717")
BLUE = colors.HexColor("#026690")
BLUE_LIGHT = colors.HexColor("#EAF5F8")
ORANGE = colors.HexColor("#EF6F32")
ORANGE_LIGHT = colors.HexColor("#FFF0E8")
WARM = colors.HexColor("#D7D3CC")
PAPER = colors.HexColor("#FBFBF9")
MID = colors.HexColor("#616161")
GRID = colors.HexColor("#DCDDDC")

rl_config.invariant = 1


def clean_text(value: object) -> str:
    text = str(value or "").replace("\u2011", "-").replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", text).strip()


def shorten(value: object, limit: int) -> str:
    text = clean_text(value)
    if len(text) <= limit:
        return text or "-"
    return text[: limit - 1].rstrip(" ,;:") + "..."


def crop_logo() -> None:
    os.makedirs(ASSET_DIR, exist_ok=True)
    image = Image.open(LOGO_SOURCE).convert("RGBA")
    rgb = image.convert("RGB")
    pixels = rgb.load()
    xs: list[int] = []
    ys: list[int] = []
    for y in range(rgb.height):
        for x in range(rgb.width):
            r, g, b = pixels[x, y]
            if min(r, g, b) < 245:
                xs.append(x)
                ys.append(y)
    if xs:
        pad = 12
        box = (
            max(0, min(xs) - pad),
            max(0, min(ys) - pad),
            min(rgb.width, max(xs) + pad),
            min(rgb.height, max(ys) + pad),
        )
        image = image.crop(box)
    white = Image.new("RGBA", image.size, "white")
    white.alpha_composite(image)
    white.convert("RGB").save(LOGO_PATH, quality=95)


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("SPC", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("SPC-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))


def draw_rounded_image(canvas, path: str, x: float, y: float, width: float, height: float, radius: float = 14) -> None:
    canvas.saveState()
    clip = canvas.beginPath()
    clip.roundRect(x, y, width, height, radius)
    canvas.clipPath(clip, stroke=0, fill=0)
    image = Image.open(path)
    iw, ih = image.size
    scale = max(width / iw, height / ih)
    dw, dh = iw * scale, ih * scale
    canvas.drawImage(ImageReader(image), x - (dw - width) / 2, y - (dh - height) / 2, dw, dh, mask="auto")
    canvas.restoreState()


def draw_logo(canvas, x: float, y: float, width: float) -> None:
    image = Image.open(LOGO_PATH)
    ratio = image.height / image.width
    canvas.drawImage(LOGO_PATH, x, y, width, width * ratio, preserveAspectRatio=True, mask="auto")


class CatalogDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str, **kwargs):
        super().__init__(filename, **kwargs)
        portrait_frame = Frame(
            MARGIN_X,
            BOTTOM_MARGIN,
            PAGE_W - 2 * MARGIN_X,
            PAGE_H - TOP_MARGIN - BOTTOM_MARGIN,
            id="portrait-frame",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates([
            PageTemplate(id="portrait", pagesize=A4, frames=[portrait_frame], onPage=self._draw_page),
        ])

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "SupplierHeading":
            supplier = flowable.getPlainText()
            key = "supplier-" + re.sub(r"[^a-z0-9]+", "-", supplier.lower()).strip("-")
            self.canv.bookmarkPage(key)
            self.canv.addOutlineEntry(supplier, key, level=0, closed=False)
            self.notify("TOCEntry", (0, supplier, self.page, key))

    def _draw_page(self, canvas, doc):
        if doc.page == 1:
            draw_cover(canvas, doc)
            return

        page_w, page_h = canvas._pagesize
        canvas.saveState()
        canvas.setFillColor(PAPER)
        canvas.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        draw_logo(canvas, page_w - MARGIN_X - 16 * mm, page_h - 11.5 * mm, 16 * mm)
        canvas.setStrokeColor(colors.HexColor("#E4E4E2"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, 13 * mm, page_w - MARGIN_X, 13 * mm)
        canvas.setFont("SPC", 7.5)
        canvas.setFillColor(MID)
        canvas.drawString(MARGIN_X, 8.7 * mm, "SPC HPC PORTFOLIO 2026")
        canvas.drawRightString(page_w - MARGIN_X, 8.7 * mm, f"{doc.page:02d}")
        canvas.restoreState()


def draw_cover(canvas, doc) -> None:
    page_w, page_h = canvas._pagesize
    canvas.saveState()
    canvas.setFillColor(WARM)
    canvas.rect(0, 0, page_w, page_h, fill=1, stroke=0)

    panel_x, panel_y = 12 * mm, 12 * mm
    panel_w, panel_h = page_w - 24 * mm, page_h - 24 * mm
    canvas.setFillColor(colors.white)
    canvas.roundRect(panel_x, panel_y, panel_w, panel_h, 20, fill=1, stroke=0)

    draw_logo(canvas, 24 * mm, page_h - 35 * mm, 27 * mm)

    canvas.setFillColor(BLUE)
    canvas.roundRect(21 * mm, page_h - 58 * mm, 42 * mm, 8 * mm, 8, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("SPC-Bold", 8.5)
    canvas.drawCentredString(42 * mm, page_h - 55.25 * mm, "HPC PORTFOLIO")

    canvas.setFillColor(INK)
    canvas.setFont("SPC-Bold", 23)
    canvas.drawString(21 * mm, page_h - 78 * mm, "Science for")
    canvas.drawString(21 * mm, page_h - 91 * mm, "every formula.")
    canvas.setFont("SPC", 9.5)
    canvas.setFillColor(MID)
    canvas.drawString(21 * mm, page_h - 104 * mm, "Nguyên liệu đúng. Giải pháp đúng.")

    draw_rounded_image(canvas, COVER_IMAGE, 91 * mm, 24 * mm, 96 * mm, page_h - 48 * mm, 18)

    canvas.setFillColor(INK)
    canvas.setFont("SPC-Bold", 10)
    canvas.drawString(21 * mm, 55 * mm, f"{getattr(doc, 'ingredient_count', 0):,} INGREDIENTS")
    canvas.drawString(21 * mm, 44 * mm, f"{getattr(doc, 'supplier_count', 0)} SUPPLIERS")
    canvas.setFillColor(ORANGE)
    canvas.drawString(21 * mm, 33 * mm, "2026 EDITION")
    canvas.restoreState()


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "toc_title": ParagraphStyle(
            "TOCTitle",
            parent=base["Heading1"],
            fontName="SPC-Bold",
            fontSize=30,
            leading=34,
            textColor=INK,
            spaceAfter=8 * mm,
        ),
        "toc_intro": ParagraphStyle(
            "TOCIntro",
            parent=base["BodyText"],
            fontName="SPC",
            fontSize=9.5,
            leading=14,
            textColor=MID,
            spaceAfter=8 * mm,
        ),
        "supplier": ParagraphStyle(
            "SupplierHeading",
            parent=base["Heading1"],
            fontName="SPC-Bold",
            fontSize=25,
            leading=29,
            textColor=INK,
            spaceAfter=4 * mm,
        ),
        "supplier_meta": ParagraphStyle(
            "SupplierMeta",
            parent=base["BodyText"],
            fontName="SPC",
            fontSize=9,
            leading=13,
            textColor=MID,
            spaceAfter=5 * mm,
            keepWithNext=True,
        ),
        "cell": ParagraphStyle(
            "Cell",
            parent=base["BodyText"],
            fontName="SPC",
            fontSize=5.8,
            leading=7.4,
            textColor=colors.HexColor("#353535"),
            alignment=TA_LEFT,
        ),
        "product": ParagraphStyle(
            "Product",
            parent=base["BodyText"],
            fontName="SPC-Bold",
            fontSize=6.2,
            leading=7.8,
            textColor=INK,
        ),
        "meta": ParagraphStyle(
            "Meta",
            parent=base["BodyText"],
            fontName="SPC",
            fontSize=5.2,
            leading=6.8,
            textColor=MID,
        ),
        "group": ParagraphStyle(
            "Group",
            parent=base["BodyText"],
            fontName="SPC-Bold",
            fontSize=6.5,
            leading=8.2,
            textColor=BLUE,
        ),
        "header": ParagraphStyle(
            "Header",
            parent=base["BodyText"],
            fontName="SPC-Bold",
            fontSize=5.4,
            leading=6.8,
            textColor=colors.white,
        ),
    }
    return styles


def product_cell(item: dict, styles) -> Paragraph:
    name = escape(shorten(item.get("name"), 120))
    return Paragraph(name, styles["product"])


def make_supplier_table(items: list[dict], group_order: dict[str, int], styles) -> LongTable:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for item in items:
        grouped[clean_text(item.get("group")) or "Khác"].append(item)

    rows = [[
        Paragraph("STT", styles["header"]),
        Paragraph("TÊN THƯƠNG MẠI", styles["header"]),
        Paragraph("THỂ CHẤT", styles["header"]),
        Paragraph("MÔ TẢ<br/>(INCI Name)", styles["header"]),
        Paragraph("ĐẶC ĐIỂM - TÁC DỤNG", styles["header"]),
        Paragraph("CERTIFICATE", styles["header"]),
    ]]
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("BACKGROUND", (-1, 0), (-1, 0), colors.HexColor("#45746C")),
        ("BOX", (0, 0), (-1, -1), 0.45, GRID),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
    ]

    product_index = 0
    ordered_groups = sorted(grouped, key=lambda name: (group_order.get(name, 9999), name.lower()))
    stripe = 0
    for group in ordered_groups:
        group_row = len(rows)
        rows.append([Paragraph(escape(group.upper()), styles["group"]), "", "", "", "", ""])
        commands.extend([
            ("SPAN", (0, group_row), (-1, group_row)),
            ("BACKGROUND", (0, group_row), (-1, group_row), BLUE_LIGHT if group_row % 2 else ORANGE_LIGHT),
            ("TOPPADDING", (0, group_row), (-1, group_row), 6),
            ("BOTTOMPADDING", (0, group_row), (-1, group_row), 6),
        ])
        for item in sorted(grouped[group], key=lambda x: clean_text(x.get("name")).lower()):
            product_index += 1
            row_index = len(rows)
            rows.append([
                Paragraph(f"<font color='#EF6F32'><b>{product_index:03d}</b></font>", styles["cell"]),
                product_cell(item, styles),
                Paragraph(escape(shorten(item.get("form"), 85)), styles["cell"]),
                Paragraph(escape(shorten(item.get("inci"), 360)), styles["cell"]),
                Paragraph(escape(shorten(item.get("description"), 480)), styles["cell"]),
                Paragraph(escape(shorten(item.get("certificates"), 190)), styles["meta"]),
            ])
            if stripe % 2:
                commands.append(("BACKGROUND", (0, row_index), (-1, row_index), colors.HexColor("#F7F7F5")))
            commands.extend([
                ("TOPPADDING", (0, row_index), (-1, row_index), 5),
                ("BOTTOMPADDING", (0, row_index), (-1, row_index), 5),
            ])
            stripe += 1

    table = LongTable(
        rows,
        colWidths=[8 * mm, 28 * mm, 17 * mm, 43 * mm, 54 * mm, 20 * mm],
        repeatRows=1,
        splitByRow=1,
        hAlign="LEFT",
    )
    table.setStyle(TableStyle(commands))
    return table


def generate_catalog() -> None:
    register_fonts()
    crop_logo()
    with open(CATALOG_PATH, "r", encoding="utf-8") as stream:
        catalog = json.load(stream)

    styles = build_styles()
    suppliers = catalog["suppliers"]
    ingredients = catalog["ingredients"]
    groups = catalog["groups"]
    group_order = {clean_text(item["name"]): index for index, item in enumerate(groups)}
    by_supplier: dict[str, list[dict]] = defaultdict(list)
    for item in ingredients:
        by_supplier[clean_text(item.get("supplier")) or "Khác"].append(item)

    doc = CatalogDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        rightMargin=MARGIN_X,
        leftMargin=MARGIN_X,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title="SPC HPC Portfolio 2026",
        author="Sapharchem",
        subject="Home and Personal Care ingredient portfolio",
    )
    doc.ingredient_count = len(ingredients)
    doc.supplier_count = len(suppliers)

    story = [Spacer(1, PAGE_H - TOP_MARGIN - BOTTOM_MARGIN), PageBreak()]
    story.extend([
        Paragraph("MỤC LỤC", styles["toc_title"]),
        Paragraph(
            f"Danh mục HPC được tổng hợp từ dữ liệu đang hiển thị trên hệ thống ngày {datetime.now(ZoneInfo('Asia/Ho_Chi_Minh')).strftime('%d/%m/%Y')}. "
            f"Gồm {len(ingredients):,} nguyên liệu từ {len(suppliers)} nhà cung cấp.",
            styles["toc_intro"],
        ),
    ])

    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle(
        name="TOCLevel0",
        fontName="SPC-Bold",
        fontSize=11,
        leading=20,
        leftIndent=0,
        firstLineIndent=0,
        textColor=INK,
        borderColor=colors.HexColor("#E6E6E3"),
        borderWidth=0,
        borderPadding=(4, 0, 4, 0),
    )]
    story.extend([toc, PageBreak()])

    for supplier_meta in suppliers:
        supplier = clean_text(supplier_meta["name"])
        items = by_supplier.get(supplier, [])
        story.extend([
            Paragraph(escape(supplier), styles["supplier"]),
            make_supplier_table(items, group_order, styles),
            PageBreak(),
        ])

    doc.multiBuild(story)
    print(OUTPUT_PATH)


if __name__ == "__main__":
    generate_catalog()
