"""
Generate a 2-page executive PDF report for Viking Sports AI Deal Analyzer.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas
import os

# ─── Brand Colors ─────────────────────────────────────────────────────────────
NAVY = HexColor("#0B1929")
DARK_NAVY = HexColor("#061220")
GOLD = HexColor("#D4A843")
DARK_GOLD = HexColor("#B8922F")
WHITE = HexColor("#FFFFFF")
LIGHT_GRAY = HexColor("#F0F2F5")
MID_GRAY = HexColor("#8A95A5")
DARK_GRAY = HexColor("#3A4555")
GREEN = HexColor("#22C55E")
RED = HexColor("#EF4444")
BLUE_ACCENT = HexColor("#3B82F6")
TABLE_ROW_ALT = HexColor("#F7F8FA")
TABLE_HEADER_BG = HexColor("#0F2440")
GOLD_LIGHT = HexColor("#FBF5E6")
BORDER_LIGHT = HexColor("#E2E6EC")

# ─── Styles ───────────────────────────────────────────────────────────────────
TITLE_STYLE = ParagraphStyle(
    'Title', fontName='Helvetica-Bold', fontSize=22, leading=28,
    textColor=NAVY, alignment=TA_LEFT, spaceAfter=2,
)
SUBTITLE_STYLE = ParagraphStyle(
    'Subtitle', fontName='Helvetica', fontSize=11, leading=15,
    textColor=MID_GRAY, alignment=TA_LEFT, spaceAfter=4,
)
SECTION_STYLE = ParagraphStyle(
    'Section', fontName='Helvetica-Bold', fontSize=11, leading=14,
    textColor=NAVY, alignment=TA_LEFT, spaceBefore=10, spaceAfter=4,
)
BODY_STYLE = ParagraphStyle(
    'Body', fontName='Helvetica', fontSize=9, leading=13,
    textColor=DARK_GRAY, alignment=TA_LEFT, spaceAfter=3,
)
BULLET_STYLE = ParagraphStyle(
    'Bullet', fontName='Helvetica', fontSize=9, leading=13,
    textColor=DARK_GRAY, alignment=TA_LEFT, leftIndent=14,
    bulletIndent=0, spaceAfter=2,
)
SMALL_STYLE = ParagraphStyle(
    'Small', fontName='Helvetica', fontSize=7.5, leading=10,
    textColor=MID_GRAY, alignment=TA_LEFT,
)
FOOTER_STYLE = ParagraphStyle(
    'Footer', fontName='Helvetica', fontSize=7, leading=9,
    textColor=MID_GRAY, alignment=TA_CENTER,
)
METRIC_VALUE = ParagraphStyle(
    'MetricVal', fontName='Helvetica-Bold', fontSize=20, leading=24,
    textColor=GOLD, alignment=TA_CENTER,
)
METRIC_LABEL = ParagraphStyle(
    'MetricLabel', fontName='Helvetica', fontSize=7.5, leading=10,
    textColor=DARK_GRAY, alignment=TA_CENTER,
)
KPI_VALUE = ParagraphStyle(
    'KPIVal', fontName='Helvetica-Bold', fontSize=14, leading=18,
    textColor=NAVY, alignment=TA_CENTER,
)
KPI_LABEL = ParagraphStyle(
    'KPILabel', fontName='Helvetica', fontSize=7, leading=9,
    textColor=MID_GRAY, alignment=TA_CENTER,
)

W, H = letter
MARGIN = 0.65 * inch
CONTENT_W = W - 2 * MARGIN


def gold_divider():
    return HRFlowable(
        width="100%", thickness=1.5, color=GOLD,
        spaceBefore=4, spaceAfter=8,
    )


def thin_divider():
    return HRFlowable(
        width="100%", thickness=0.5, color=BORDER_LIGHT,
        spaceBefore=6, spaceAfter=6,
    )


def section_header(text):
    return Paragraph(
        f'<font color="#{GOLD.hexval()[2:]}">//</font>  {text}',
        SECTION_STYLE
    )


def bullet(text):
    return Paragraph(f'<bullet>&bull;</bullet> {text}', BULLET_STYLE)


def make_metric_card(value, label, color=GOLD):
    val_style = ParagraphStyle(
        'mv', fontName='Helvetica-Bold', fontSize=18, leading=22,
        textColor=color, alignment=TA_CENTER,
    )
    lab_style = ParagraphStyle(
        'ml', fontName='Helvetica', fontSize=7, leading=9,
        textColor=DARK_GRAY, alignment=TA_CENTER, spaceAfter=0,
    )
    t = Table(
        [[Paragraph(value, val_style)], [Paragraph(label, lab_style)]],
        colWidths=[CONTENT_W / 4 - 8],
        rowHeights=[26, 14],
    )
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 6),
        ('ROUNDEDCORNERS', [6, 6, 6, 6]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    return t


def build_header_bar():
    """Gold accent bar + title block"""
    elements = []
    # Gold top bar
    bar = Table([['']], colWidths=[CONTENT_W], rowHeights=[4])
    bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD),
        ('LINEBELOW', (0, 0), (-1, -1), 0, GOLD),
    ]))
    elements.append(bar)
    elements.append(Spacer(1, 10))

    # Title row with date
    title_para = Paragraph("Viking Sports — AI Deal Analyzer", TITLE_STYLE)
    date_style = ParagraphStyle(
        'Date', fontName='Helvetica', fontSize=9, textColor=MID_GRAY, alignment=TA_RIGHT,
    )
    date_para = Paragraph("April 2026", date_style)
    badge_style = ParagraphStyle(
        'Badge', fontName='Helvetica-Bold', fontSize=7, textColor=DARK_GOLD,
        alignment=TA_RIGHT, spaceBefore=2,
    )
    badge_para = Paragraph("CONFIDENTIAL", badge_style)

    header_table = Table(
        [[title_para, [date_para, badge_para]]],
        colWidths=[CONTENT_W * 0.72, CONTENT_W * 0.28],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)

    elements.append(Paragraph(
        "Model Performance Report  |  Machine Learning Investment Signal for Sports Memorabilia",
        SUBTITLE_STYLE
    ))
    elements.append(gold_divider())
    return elements


def page1():
    elements = []
    elements.extend(build_header_bar())

    # ── Hero KPI Cards ────────────────────────────────────────────────────────
    cards = [
        make_metric_card("0.872", "Test AUC (ROC)"),
        make_metric_card("77.4%", "Test Accuracy"),
        make_metric_card("0.774", "F1 Score"),
        make_metric_card("12,089", "Training Rows", color=NAVY),
    ]
    kpi_table = Table([cards], colWidths=[CONTENT_W / 4] * 4)
    kpi_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 6))

    # ── What It Does ──────────────────────────────────────────────────────────
    elements.append(section_header("WHAT IT DOES"))
    elements.append(bullet(
        '<b>XGBoost gradient-boosted decision tree</b> model that predicts whether a '
        'sports memorabilia deal is a <font color="#22C55E"><b>BUY</b></font> or '
        '<font color="#EF4444"><b>NOT BUY</b></font>'
    ))
    elements.append(bullet(
        '<b>5 inputs:</b> Asset Type (12 categories), Hold Period (1-40 yrs), '
        'Purchase Price Tier (5 tiers), Acquisition Decade (1980s-2020s), Deal Status'
    ))
    elements.append(bullet(
        'Returns <b>probability score</b> (0-100%) with <b>confidence level</b> (High / Medium / Low)'
    ))
    elements.append(bullet(
        'Runs <b>entirely in-browser</b> with &lt; 2 second inference &mdash; no server calls required'
    ))

    # ── Training Data ─────────────────────────────────────────────────────────
    elements.append(section_header("TRAINING DATA"))

    data_table_data = [
        ['Source', 'Rows', 'Description'],
        ['Original Deals', '89', 'Real Viking Sports historical transactions'],
        ['Synthetic Augmentation', '12,000', 'Generated via conditional probability tables from original patterns'],
        ['Combined Dataset', '12,089', '80/20 stratified train-test split (9,671 / 2,418)'],
    ]
    data_table = Table(data_table_data, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.12, CONTENT_W * 0.66])
    data_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('LEADING', (0, 0), (-1, -1), 11),
        ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ALT),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
    ]))
    elements.append(data_table)
    elements.append(Paragraph(
        '&nbsp;&nbsp;Class balance: 6,088 NOT BUY vs 6,001 BUY (near-equal)',
        SMALL_STYLE
    ))

    # ── Model Selection ───────────────────────────────────────────────────────
    elements.append(section_header("MODEL SELECTION PROCESS"))
    elements.append(bullet(
        'Tested <b>2 algorithms</b>: XGBoost and LightGBM'
    ))
    elements.append(bullet(
        'Tested <b>3 resampling strategies</b>: SMOTE, SMOTETomek, No resampling'
    ))
    elements.append(bullet(
        '<b>100 Optuna Bayesian optimization trials</b> per combination (600 total trials)'
    ))
    elements.append(bullet(
        '<b>5-fold stratified cross-validation</b> for robust, unbiased evaluation'
    ))

    # Winner callout
    winner_data = [[
        Paragraph(
            '<font color="#D4A843"><b>WINNER:</b></font>&nbsp;&nbsp;'
            'XGBoost + No Resampling &mdash; depth=3, 800 trees, lr=0.016, '
            'Optuna-tuned across 9 hyperparameters',
            ParagraphStyle('wp', fontName='Helvetica', fontSize=8.5, leading=12,
                           textColor=NAVY, alignment=TA_LEFT)
        )
    ]]
    winner_table = Table(winner_data, colWidths=[CONTENT_W])
    winner_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('LINEBELOW', (0, 0), (-1, -1), 2, GOLD),
    ]))
    elements.append(Spacer(1, 4))
    elements.append(winner_table)

    # ── Model Leaderboard ─────────────────────────────────────────────────────
    elements.append(section_header("MODEL LEADERBOARD"))

    lb_data = [
        ['Rank', 'Algorithm', 'Sampling', 'Test AUC', 'Accuracy', 'F1', 'Precision', 'Recall'],
        ['1', 'XGBoost', 'None', '0.872', '77.4%', '0.774', '76.9%', '77.8%'],
        ['2', 'LightGBM', 'SMOTE', '0.871', '77.6%', '0.776', '77.0%', '78.2%'],
        ['3', 'XGBoost', 'SMOTE', '0.871', '77.4%', '0.776', '76.5%', '78.8%'],
        ['4', 'LightGBM', 'None', '0.870', '77.3%', '0.773', '76.8%', '77.8%'],
        ['5', 'LightGBM', 'SMOTETomek', '0.865', '77.4%', '0.774', '76.9%', '77.9%'],
        ['6', 'XGBoost', 'SMOTETomek', '0.864', '77.4%', '0.774', '77.0%', '77.8%'],
    ]
    col_w = [CONTENT_W * w for w in [0.06, 0.13, 0.14, 0.12, 0.12, 0.11, 0.12, 0.11]]
    lb_table = Table(lb_data, colWidths=col_w)
    lb_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('LEADING', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 1), (-1, 1), GOLD_LIGHT),
        ('BACKGROUND', (0, 3), (-1, 3), TABLE_ROW_ALT),
        ('BACKGROUND', (0, 5), (-1, 5), TABLE_ROW_ALT),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
        ('FONTNAME', (0, 1), (-1, 1), 'Helvetica-Bold'),
    ]))
    elements.append(lb_table)

    elements.append(PageBreak())
    return elements


def page2():
    elements = []

    # Header bar page 2
    bar = Table([['']], colWidths=[CONTENT_W], rowHeights=[4])
    bar.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), GOLD)]))
    elements.append(bar)
    elements.append(Spacer(1, 6))

    p2_title = ParagraphStyle(
        'P2Title', fontName='Helvetica-Bold', fontSize=15, leading=18,
        textColor=NAVY, alignment=TA_LEFT, spaceAfter=1,
    )
    elements.append(Paragraph("Performance Deep Dive", p2_title))
    elements.append(Paragraph("Detailed metrics, feature analysis, and prediction examples", SUBTITLE_STYLE))
    elements.append(gold_divider())

    # ── Key Metrics + Confusion Matrix side by side ───────────────────────────
    elements.append(section_header("KEY METRICS"))

    metrics_data = [
        ['Metric', 'Score'],
        ['Test AUC (ROC)', '0.872'],
        ['Test Accuracy', '77.4%'],
        ['Test F1 Score', '0.774'],
        ['Test Precision', '76.9%'],
        ['Test Recall', '77.8%'],
        ['Cross-Val AUC', '0.871 +/- 0.003'],
        ['Cross-Val Accuracy', '77.9% +/- 0.5%'],
    ]
    metrics_table = Table(metrics_data, colWidths=[CONTENT_W * 0.25, CONTENT_W * 0.18])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('LEADING', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ALT),
        ('BACKGROUND', (0, 4), (-1, 4), TABLE_ROW_ALT),
        ('BACKGROUND', (0, 6), (-1, 6), TABLE_ROW_ALT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
    ]))

    # Confusion matrix
    cm_title = Paragraph(
        '<b>Confusion Matrix</b>',
        ParagraphStyle('cmt', fontName='Helvetica-Bold', fontSize=9, leading=12,
                       textColor=NAVY, alignment=TA_CENTER, spaceAfter=4)
    )
    cm_data = [
        ['', 'Pred: NOT BUY', 'Pred: BUY'],
        ['Actual: NOT BUY', '937 (TN)', '281 (FP)'],
        ['Actual: BUY', '266 (FN)', '934 (TP)'],
    ]
    cm_table = Table(cm_data, colWidths=[CONTENT_W * 0.16, CONTENT_W * 0.14, CONTENT_W * 0.14])
    cm_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('BACKGROUND', (0, 1), (0, -1), HexColor("#E8EBF0")),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('LEADING', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (1, 1), (1, 1), HexColor("#E8F5E9")),  # TN green tint
        ('BACKGROUND', (2, 2), (2, 2), HexColor("#E8F5E9")),  # TP green tint
        ('BACKGROUND', (2, 1), (2, 1), HexColor("#FFEBEE")),  # FP red tint
        ('BACKGROUND', (1, 2), (1, 2), HexColor("#FFEBEE")),  # FN red tint
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
    ]))

    right_col = [cm_title, Spacer(1, 2), cm_table]

    side_by_side = Table(
        [[metrics_table, right_col]],
        colWidths=[CONTENT_W * 0.46, CONTENT_W * 0.54],
    )
    side_by_side.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 16),
    ]))
    elements.append(side_by_side)

    # ── Feature Importances ───────────────────────────────────────────────────
    elements.append(section_header("TOP FEATURE IMPORTANCES"))

    fi_data = [
        ['Rank', 'Feature', 'Importance', ''],
        ['1', 'Acquisition Decade', '10.3%', ''],
        ['2', 'Tickets & Passes (type)', '9.0%', ''],
        ['3', 'Is Rookie Card', '8.3%', ''],
        ['4', 'Hold Period Bucket', '7.6%', ''],
        ['5', 'Price Tier', '5.5%', ''],
    ]

    # Add visual bars
    max_imp = 10.3
    bar_widths = [10.3, 9.0, 8.3, 7.6, 5.5]
    for i, bw in enumerate(bar_widths):
        bar_pct = bw / max_imp
        filled = int(bar_pct * 20)
        bar_str = '<font color="#D4A843">' + '|' * filled + '</font>' + \
                  '<font color="#E2E6EC">' + '|' * (20 - filled) + '</font>'
        fi_data[i + 1][3] = Paragraph(bar_str, ParagraphStyle(
            'bar', fontName='Courier-Bold', fontSize=8, leading=10, textColor=GOLD))

    fi_table = Table(fi_data, colWidths=[CONTENT_W * 0.06, CONTENT_W * 0.30, CONTENT_W * 0.12, CONTENT_W * 0.30])
    fi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('LEADING', (0, 0), (-1, -1), 10),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'CENTER'),
        ('BACKGROUND', (0, 2), (-1, 2), TABLE_ROW_ALT),
        ('BACKGROUND', (0, 4), (-1, 4), TABLE_ROW_ALT),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
    ]))
    elements.append(fi_table)

    # ── Sample Predictions ────────────────────────────────────────────────────
    elements.append(section_header("SAMPLE PREDICTIONS"))
    elements.append(Paragraph(
        'Demonstrating model discrimination across different deal profiles:',
        SMALL_STYLE
    ))
    elements.append(Spacer(1, 2))

    sp_data = [
        ['Asset Type', 'Hold', 'Decade', 'Price Tier', 'Probability', 'Signal'],
        ['Rookie Cards', '10 yr', '2000s', 'Under $50', '94.1%', 'BUY'],
        ['Memorabilia', '20 yr', '2000s', '$50-$500', '98.9%', 'BUY'],
        ['Publications', '30 yr', '1990s', 'Under $50', '98.2%', 'BUY'],
        ['Stickers', '8 yr', '2010s', '$50-$500', '78.9%', 'BUY'],
        ['Tickets & Passes', '5 yr', '2010s', '$50-$500', '39.8%', 'NOT BUY'],
        ['Rookie Cards', '2 yr', '2020s', '$500-$5K', '15.9%', 'NOT BUY'],
        ['Cards (Non-Rookie)', '1 yr', '2020s', '$5K-$20K', '13.6%', 'NOT BUY'],
        ['Game-Worn Jerseys', '3 yr', '2020s', '$5K-$20K', '1.4%', 'NOT BUY'],
    ]
    sp_col_w = [CONTENT_W * w for w in [0.22, 0.08, 0.10, 0.15, 0.14, 0.14]]
    sp_table = Table(sp_data, colWidths=sp_col_w)

    sp_style = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_BG),
        ('TEXTCOLOR', (0, 0), (-1, 0), WHITE),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('LEADING', (0, 0), (-1, -1), 9),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_LIGHT),
        ('LINEBELOW', (0, 0), (-1, 0), 1, GOLD),
    ]
    # Color BUY rows green tint, NOT BUY rows red tint
    for i in range(1, len(sp_data)):
        if sp_data[i][5] == 'BUY':
            sp_style.append(('BACKGROUND', (5, i), (5, i), HexColor("#E8F5E9")))
            sp_style.append(('TEXTCOLOR', (5, i), (5, i), GREEN))
        else:
            sp_style.append(('BACKGROUND', (5, i), (5, i), HexColor("#FFEBEE")))
            sp_style.append(('TEXTCOLOR', (5, i), (5, i), RED))
        if i % 2 == 0:
            sp_style.append(('BACKGROUND', (0, i), (4, i), TABLE_ROW_ALT))
    sp_style.append(('FONTNAME', (5, 1), (5, -1), 'Helvetica-Bold'))

    sp_table.setStyle(TableStyle(sp_style))
    elements.append(sp_table)

    # ── Path to Higher Accuracy ───────────────────────────────────────────────
    elements.append(section_header("PATH TO HIGHER ACCURACY"))

    roadmap_data = [[
        Paragraph(
            '<b>Current ceiling (~78%)</b> is driven by synthetic data limitations, not model architecture. '
            'Improvements to push past 85%+:',
            ParagraphStyle('rd', fontName='Helvetica', fontSize=7.5, leading=10,
                           textColor=DARK_GRAY, alignment=TA_LEFT)
        )
    ]]
    roadmap_table = Table(roadmap_data, colWidths=[CONTENT_W])
    roadmap_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), GOLD_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(roadmap_table)
    elements.append(Spacer(1, 2))

    compact_bullet = ParagraphStyle(
        'CBullet', fontName='Helvetica', fontSize=8, leading=11,
        textColor=DARK_GRAY, alignment=TA_LEFT, leftIndent=14,
        bulletIndent=0, spaceAfter=1,
    )
    elements.append(Paragraph(
        '<bullet>&bull;</bullet> <b>More real data</b> &mdash; Expand from 89 to 300-500+ real deals for genuine market signal',
        compact_bullet
    ))
    elements.append(Paragraph(
        '<bullet>&bull;</bullet> <b>CTGAN synthetic generation</b> &mdash; Neural network learns real distributions vs. hand-coded rules',
        compact_bullet
    ))
    elements.append(Paragraph(
        '<bullet>&bull;</bullet> <b>Richer features</b> &mdash; Player popularity, sport type, condition grade, market timing',
        compact_bullet
    ))
    elements.append(Paragraph(
        '<bullet>&bull;</bullet> <b>Ensemble stacking</b> &mdash; XGBoost + LightGBM + Random Forest with meta-learner',
        compact_bullet
    ))

    # ── Hyperparameters (compact) ─────────────────────────────────────────────
    elements.append(section_header("OPTIMIZED HYPERPARAMETERS"))

    hp_text = (
        '<b>max_depth:</b> 3 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>n_estimators:</b> 800 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>learning_rate:</b> 0.016 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>subsample:</b> 0.66 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>colsample_bytree:</b> 0.61 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>min_child_weight:</b> 7 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>gamma:</b> 0.47 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>reg_alpha:</b> 0.042 &nbsp;&nbsp;|&nbsp;&nbsp; '
        '<b>reg_lambda:</b> 0.007'
    )
    hp_para = Paragraph(hp_text, ParagraphStyle(
        'hp', fontName='Helvetica', fontSize=7.5, leading=11,
        textColor=DARK_GRAY, alignment=TA_LEFT,
    ))
    hp_box = Table([[hp_para]], colWidths=[CONTENT_W])
    hp_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_GRAY),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(hp_box)

    # Footer
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_LIGHT, spaceBefore=0, spaceAfter=4))
    elements.append(Paragraph(
        "Prepared by Viking Sports Data Science  |  Confidential  |  April 2026",
        FOOTER_STYLE
    ))

    return elements


# ─── Build PDF ────────────────────────────────────────────────────────────────

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_PATH = os.path.join(OUT_DIR, "..", "Viking_Sports_Model_Report.pdf")

doc = SimpleDocTemplate(
    OUT_PATH,
    pagesize=letter,
    leftMargin=MARGIN,
    rightMargin=MARGIN,
    topMargin=0.5 * inch,
    bottomMargin=0.4 * inch,
)

story = page1() + page2()
doc.build(story)

print(f"PDF generated: {os.path.abspath(OUT_PATH)}")
