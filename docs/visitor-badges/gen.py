import base64, io
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor, white, black
from PIL import Image, ImageDraw, ImageFont
from qrgen import styled_qr
import os, textwrap

QR_URL = 'https://sclf.occph.com'
# ---- EDIT THESE ----
PRESIDENT_NAME = "[ FULL NAME OF OCC PRESIDENT ]"   # printed under the signature line
PRESIDENT_TITLE = 'College President, Opol Community College'
SIGNATURE_IMG = '/tmp/signature.png'                # optional: transparent PNG of the signature
TERMS = [
    'Valid only for the date and campus shown. Wear it visibly at all times while on campus.',
    'Non-transferable. Return it to Security before leaving; report a lost badge right away.',
    'Your details are collected for campus security under the Data Privacy Act of 2012 (RA 10173) and used only for that purpose.',
]
QR_IMG = styled_qr(QR_URL, px=1200)
QR_IMG.save('/tmp/qr_occ.png')
qr_reader = ImageReader('/tmp/qr_occ.png')

DAYS = [  # letter, name, color
    ('M','MONDAY','#2563eb'), ('T','TUESDAY','#db2777'), ('W','WEDNESDAY','#16a34a'),
    ('H','THURSDAY','#ea580c'), ('F','FRIDAY','#7c3aed'), ('S','SATURDAY','#0891b2'), ('U','SUNDAY','#dc2626'),
]
COUNT = 200
BW, BH = 54*mm, 86*mm
logo = ImageReader('/tmp/logo.png')

def label(letter, n): return f"{letter}-{n:02d}"

def draw_badge(c, x, y, letter, name, color, n):
    col = HexColor(color)
    c.saveState()
    c.setFillColor(white); c.setStrokeColor(col); c.setLineWidth(1.6)
    c.roundRect(x, y, BW, BH, 4*mm, fill=1, stroke=1)
    # header
    c.setFillColor(col)
    p = c.beginPath(); p.roundRect(x, y+BH-22*mm, BW, 22*mm, 4*mm); 
    c.clipPath(p, stroke=0, fill=0)
    c.rect(x, y+BH-22*mm, BW, 22*mm, fill=1, stroke=0)
    c.restoreState(); c.saveState()
    c.setFillColor(col); c.rect(x, y+BH-22*mm, BW, 6*mm, fill=1, stroke=0)  # square off header bottom
    # lanyard slot
    c.setFillColor(white); c.roundRect(x+BW/2-7*mm, y+BH-7*mm, 14*mm, 3*mm, 1.5*mm, fill=1, stroke=0)
    c.setFillColor(white); c.setFont('Helvetica-Bold', 15); c.drawCentredString(x+BW/2, y+BH-17*mm, 'VISITOR')
    # logo
    c.drawImage(logo, x+BW/2-14*mm, y+BH-22*mm-31*mm, 28*mm, 28*mm, mask='auto')
    c.setFillColor(HexColor('#1e1b4b')); c.setFont('Helvetica-Bold', 8.5)
    c.drawCentredString(x+BW/2, y+BH-22*mm-35*mm, 'Opol Community College')
    # number
    txt = label(letter, n)
    size = 40 if len(txt) <= 4 else 34
    c.setFont('Helvetica-Bold', size); c.setFillColor(col)
    c.drawCentredString(x+BW/2, y+17*mm, txt)
    c.setFont('Helvetica-Bold', 8); c.setFillColor(HexColor('#475569'))
    c.drawCentredString(x+BW/2, y+11*mm, name)
    c.setFont('Helvetica', 6.5); c.setFillColor(HexColor('#64748b'))
    c.drawCentredString(x+BW/2, y+6*mm, 'Return to Security before leaving campus')
    c.restoreState()


def wrap_lines(c, text, font, size, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if c.stringWidth(t, font, size) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def draw_back(c, x, y, letter, name, color):
    col = HexColor(color)
    c.saveState()
    c.setFillColor(white); c.setStrokeColor(col); c.setLineWidth(1.6)
    c.roundRect(x, y, BW, BH, 4*mm, fill=1, stroke=1)
    # header band (rounded top, squared bottom)
    c.saveState()
    p = c.beginPath(); p.roundRect(x, y, BW, BH, 4*mm); c.clipPath(p, stroke=0, fill=0)
    c.setFillColor(col); c.rect(x, y+BH-15*mm, BW, 15*mm, fill=1, stroke=0)
    c.restoreState()
    c.setFillColor(white); c.roundRect(x+BW/2-7*mm, y+BH-5.5*mm, 14*mm, 2.6*mm, 1.3*mm, fill=1, stroke=0)
    c.setFont('Helvetica-Bold', 17); c.drawCentredString(x+BW/2, y+BH-11.5*mm, 'SCLF')
    c.setFont('Helvetica', 5.8); c.drawCentredString(x+BW/2, y+BH-14*mm, 'Opol Community College')
    # QR (styled, OCC logo in the middle)
    q = 27*mm
    c.drawImage(qr_reader, x+BW/2-q/2, y+BH-15*mm-1.5*mm-q, q, q)
    c.setFillColor(HexColor('#1B1F3B')); c.setFont('Helvetica-Bold', 6.6)
    c.drawCentredString(x+BW/2, y+BH-15*mm-1.5*mm-q-3*mm, 'Scan to open SCLF')
    c.setFont('Helvetica', 6); c.setFillColor(col)
    c.drawCentredString(x+BW/2, y+BH-15*mm-1.5*mm-q-5.6*mm, QR_URL.replace('https://', ''))
    # terms & privacy
    ty = y+BH-15*mm-1.5*mm-q-9.2*mm
    c.setFillColor(HexColor('#1e1b4b')); c.setFont('Helvetica-Bold', 5.6)
    c.drawString(x+4*mm, ty, 'TERMS OF SERVICE & PRIVACY')
    ty -= 2.5*mm
    c.setFont('Helvetica', 4.9); c.setFillColor(HexColor('#334155'))
    for i, t in enumerate(TERMS, 1):
        for j, ln in enumerate(wrap_lines(c, t, 'Helvetica', 4.9, BW-8*mm-2.2*mm)):
            if j == 0: c.drawString(x+4*mm, ty, f'{i}.')
            c.drawString(x+4*mm+2.2*mm, ty, ln); ty -= 2.05*mm
        ty -= 0.3*mm
    # signature block
    sy = y+11.2*mm
    if os.path.exists(SIGNATURE_IMG):
        c.drawImage(SIGNATURE_IMG, x+BW/2-13*mm, sy+0.6*mm, 26*mm, 9*mm, mask='auto', preserveAspectRatio=True)
    c.setStrokeColor(HexColor('#334155')); c.setLineWidth(0.5)
    c.line(x+6*mm, sy, x+BW-6*mm, sy)
    c.setFillColor(HexColor('#1e1b4b')); c.setFont('Helvetica-Bold', 6.4)
    nm = PRESIDENT_NAME
    c.drawCentredString(x+BW/2, sy-2.8*mm, nm)
    c.setFont('Helvetica', 5.2); c.setFillColor(HexColor('#475569'))
    c.drawCentredString(x+BW/2, sy-5.2*mm, PRESIDENT_TITLE)
    c.restoreState()

def make_pdf(letter, name, color, path):
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle(f'OCC Visitor Badges {letter}-01 to {letter}-{COUNT}')
    cols, rows = 3, 3
    mx = (A4[0]-cols*BW)/2; my = (A4[1]-rows*BH)/2
    per = cols*rows
    for start in range(0, COUNT, per):
        chunk = range(start, min(start+per, COUNT))
        # FRONT sheet
        for i in chunk:
            r, cc = divmod(i - start, cols)
            x = mx + cc*BW; y = A4[1]-my-(r+1)*BH
            c.setStrokeColor(HexColor('#cbd5e1')); c.setLineWidth(0.3); c.setDash(2,2)
            c.rect(x, y, BW, BH, fill=0, stroke=1); c.setDash()
            draw_badge(c, x, y, letter, name, color, i+1)
        c.showPage()
        # BACK sheet — columns mirrored so each back lines up behind its
        # front when printed double-sided (flip on long edge)
        for i in chunk:
            r, cc = divmod(i - start, cols)
            x = mx + (cols-1-cc)*BW; y = A4[1]-my-(r+1)*BH
            c.setStrokeColor(HexColor('#cbd5e1')); c.setLineWidth(0.3); c.setDash(2,2)
            c.rect(x, y, BW, BH, fill=0, stroke=1); c.setDash()
            draw_back(c, x, y, letter, name, color)
        c.showPage()
    c.save()

for letter, name, color in DAYS:
    make_pdf(letter, name, color, f'/mnt/user-data/outputs/badges/OCC_Visitor_Badges_{name.title()}_{letter}-01_to_{letter}-{COUNT}_front-and-back.pdf')

# ---- PNG badge (300 dpi) with PIL
S = 300/25.4
def px(mm_): return int(round(mm_*S))
def font(sz, bold=True):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
def png_badge(letter, name, color, n, path):
    W, H = px(54), px(86)
    im = Image.new('RGBA', (W, H), (0,0,0,0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,W-1,H-1], radius=px(4), fill='white', outline=color, width=px(0.6))
    hdr = Image.new('RGBA', (W, H), (0,0,0,0)); hd = ImageDraw.Draw(hdr)
    hd.rounded_rectangle([0,0,W-1,px(22)+px(6)], radius=px(4), fill=color)
    hd.rectangle([0,px(22),W,px(22)+px(6)], fill=(0,0,0,0))
    hd.rectangle([0,px(16),W,px(22)], fill=color)
    mask = Image.new('L', (W,H), 0); ImageDraw.Draw(mask).rounded_rectangle([0,0,W-1,H-1], radius=px(4), fill=255)
    im.paste(hdr, (0,0), Image.composite(hdr.split()[3], Image.new('L',(W,H),0), mask))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([W//2-px(7), px(4), W//2+px(7), px(7)], radius=px(1.5), fill='white')
    def ctext(t, y, f, fill):
        w = d.textlength(t, font=f); d.text(((W-w)/2, y), t, font=f, fill=fill)
    ctext('VISITOR', px(10.5), font(px(5.2)), 'white')
    lg = Image.open('/tmp/logo.png').convert('RGBA').resize((px(28), px(28)), Image.LANCZOS)
    im.alpha_composite(lg, (W//2-px(14), px(25)))
    ctext('Opol Community College', px(55.5), font(px(3.1)), '#1e1b4b')
    t = label(letter, n) if n else f'{letter}-__'
    ctext(t, px(60), font(px(13)), color)
    ctext(name, px(75), font(px(2.9)), '#475569')
    ctext('Return to Security before leaving campus', px(80), font(px(2.2), False), '#64748b')
    im.save(path)

png_badge('M','MONDAY','#2563eb',1,'/mnt/user-data/outputs/badges/OCC_Visitor_Badge_Monday_M-01_sample.png')
png_badge('M','MONDAY','#2563eb',0,'/mnt/user-data/outputs/badges/OCC_Visitor_Badge_blank_template.png')

# ---- editable SVG template (open in Inkscape / Canva / Illustrator)
b64 = base64.b64encode(open('/tmp/logo.png','rb').read()).decode()
for letter, name, color in DAYS[:1]:
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="54mm" height="86mm" viewBox="0 0 540 860">
  <defs><clipPath id="card"><rect width="540" height="860" rx="40"/></clipPath></defs>
  <rect x="3" y="3" width="534" height="854" rx="40" fill="#fff" stroke="{color}" stroke-width="6"/>
  <g clip-path="url(#card)"><rect width="540" height="220" fill="{color}"/></g>
  <rect x="200" y="40" width="140" height="30" rx="15" fill="#fff"/>
  <text x="270" y="170" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="56" fill="#fff">VISITOR</text>
  <image x="130" y="250" width="280" height="280" xlink:href="data:image/png;base64,{b64}"/>
  <text x="270" y="565" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="30" fill="#1e1b4b">Opol Community College</text>
  <!-- EDIT: change the letter, number and day name below -->
  <text id="badge-number" x="270" y="700" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="130" fill="{color}">{letter}-01</text>
  <text id="day-name" x="270" y="765" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="28" fill="#475569">{name}</text>
  <text x="270" y="820" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#64748b">Return to Security before leaving campus</text>
</svg>'''
    open('/mnt/user-data/outputs/badges/OCC_Visitor_Badge_editable_template.svg','w').write(svg)


# ---- back PNG (300 dpi) -------------------------------------------------
def png_back(letter, name, color, path):
    W, H = px(54), px(86)
    im = Image.new('RGBA', (W, H), (0,0,0,0)); d = ImageDraw.Draw(im)
    mask = Image.new('L', (W,H), 0); ImageDraw.Draw(mask).rounded_rectangle([0,0,W-1,H-1], radius=px(4), fill=255)
    base = Image.new('RGBA', (W,H), 'white'); bd = ImageDraw.Draw(base)
    bd.rectangle([0,0,W,px(15)], fill=color)
    bd.rounded_rectangle([W//2-px(7), px(2.9), W//2+px(7), px(5.5)], radius=px(1.3), fill='white')
    im.paste(base, (0,0), mask); d = ImageDraw.Draw(im)
    d.rounded_rectangle([0,0,W-1,H-1], radius=px(4), outline=color, width=px(0.6))
    def ct(t, y, f, fill):
        w = d.textlength(t, font=f); d.text(((W-w)/2, y), t, font=f, fill=fill)
    ct('SCLF', px(5.2), font(px(5.6)), 'white')
    ct('Opol Community College', px(11.6), font(px(2.0), False), 'white')
    q = px(25); qi = QR_IMG.resize((q, q), Image.LANCZOS)
    im.paste(qi, (W//2-q//2, px(16)))
    ct('Scan to open SCLF', px(42.2), font(px(2.3)), '#1B1F3B')
    ct(QR_URL.replace('https://',''), px(45.1), font(px(2.1), False), color)
    y = px(49.5)
    d.text((px(4), y), 'TERMS OF SERVICE & PRIVACY', font=font(px(1.95)), fill='#1e1b4b'); y += px(3.4)
    f = font(px(1.7), False)
    for i, t in enumerate(TERMS, 1):
        maxw = W - px(6.4) - px(4)
        lines, cur = [], ''
        for w in t.split():
            trial = (cur + ' ' + w).strip()
            if d.textlength(trial, font=f) <= maxw: cur = trial
            else: lines.append(cur); cur = w
        if cur: lines.append(cur)
        for j, ln in enumerate(lines):
            if j == 0: d.text((px(4), y), f'{i}.', font=f, fill='#334155')
            d.text((px(6.4), y), ln, font=f, fill='#334155'); y += px(2.45)
        y += px(0.4)
    sy = px(86-11.2)
    if os.path.exists(SIGNATURE_IMG):
        sg = Image.open(SIGNATURE_IMG).convert('RGBA'); sg.thumbnail((px(26), px(9)))
        im.alpha_composite(sg, (W//2-sg.size[0]//2, sy-sg.size[1]-px(0.6)))
    d.line([px(6), sy, W-px(6), sy], fill='#334155', width=3)
    ct(PRESIDENT_NAME, sy+px(1.1), font(px(2.3)), '#1e1b4b')
    ct(PRESIDENT_TITLE, sy+px(4.1), font(px(1.85), False), '#475569')
    im.save(path)

png_back('M','MONDAY','#2563eb','/mnt/user-data/outputs/badges/OCC_Visitor_Badge_BACK_sample.png')
qr_only = QR_IMG.copy(); qr_only.save('/mnt/user-data/outputs/badges/OCC_SCLF_QR_sclf.occph.com.png')

# ---- editable back SVG ----------------------------------------------------
buf = io.BytesIO(); QR_IMG.resize((600,600), Image.LANCZOS).save(buf, 'PNG'); qrb64 = base64.b64encode(buf.getvalue()).decode()
col = DAYS[0][2]
terms_svg = ''
ty = 553
for i, t in enumerate(TERMS, 1):
    for j, ln in enumerate(textwrap.wrap(t, 52)):
        terms_svg += f'  <text x="{40 if j==0 else 62}" y="{ty}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#334155">{(str(i)+". ") if j==0 else ""}{ln}</text>\n'
        ty += 20
    ty += 4
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="54mm" height="86mm" viewBox="0 0 540 860">
  <defs><clipPath id="card"><rect width="540" height="860" rx="40"/></clipPath></defs>
  <rect x="3" y="3" width="534" height="854" rx="40" fill="#fff" stroke="{col}" stroke-width="6"/>
  <g clip-path="url(#card)"><rect width="540" height="150" fill="{col}"/></g>
  <rect x="200" y="30" width="140" height="26" rx="13" fill="#fff"/>
  <text x="270" y="108" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="58" fill="#fff">SCLF</text>
  <text x="270" y="138" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#fff">Opol Community College</text>
  <image x="135" y="165" width="270" height="270" xlink:href="data:image/png;base64,{qrb64}"/>
  <text x="270" y="462" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="23" fill="#1B1F3B">Scan to open SCLF</text>
  <text x="270" y="490" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" fill="{col}">{QR_URL.replace("https://","")}</text>
  <text x="40" y="528" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="19" fill="#1e1b4b">TERMS OF SERVICE &amp; PRIVACY</text>
{terms_svg}  <!-- EDIT: signature line + president name -->
  <line x1="60" y1="748" x2="480" y2="748" stroke="#334155" stroke-width="3"/>
  <text id="president-name" x="270" y="780" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="24" fill="#1e1b4b">{PRESIDENT_NAME}</text>
  <text x="270" y="808" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="#475569">{PRESIDENT_TITLE}</text>
</svg>'''
open('/mnt/user-data/outputs/badges/OCC_Visitor_Badge_BACK_editable_template.svg','w').write(svg)
