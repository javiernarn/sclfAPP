# Same look as resources/js/Components/shared/StyledQrCode.jsx:
# rounded dot modules (r = 0.48 cell), rounded-square finder eyes, navy ink,
# EC level H, white rounded roundel with the OCC logo in the middle (26% of grid).
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw

def styled_qr(value, px=1200, color='#1B1F3B', logo='/tmp/logo.png', quiet=0.06):
    q = qrcode.QRCode(error_correction=ERROR_CORRECT_H, border=0, box_size=1)
    q.add_data(value); q.make(fit=True)
    m = q.get_matrix(); n = len(m)
    pad = int(px * quiet)
    cell = px / n
    W = px + pad * 2
    SS = 2  # supersample for smooth edges
    im = Image.new('RGB', (W*SS, W*SS), 'white'); d = ImageDraw.Draw(im)
    def X(c): return (pad + c*cell) * SS
    def finder(r0, c0):
        o = 7 * cell
        x, y = X(c0), X(r0)
        rr = lambda a, b, s, rad, fill: d.rounded_rectangle([a, b, a+s, b+s], radius=rad, fill=fill)
        rr(x, y, o*SS, o*SS*0.08, color)
        i1 = cell*SS; rr(x+i1, y+i1, (o-2*cell)*SS, (o-2*cell)*SS*0.08, 'white')
        i2 = 2*cell*SS; rr(x+i2, y+i2, (o-4*cell)*SS, (o-4*cell)*SS*0.08, color)
    inF = lambda r, c: (r < 7 and c < 7) or (r < 7 and c >= n-7) or (r >= n-7 and c < 7)
    lm = int(n*0.26); ls = (n-lm)//2; le = ls+lm
    inL = lambda r, c: ls <= r < le and ls <= c < le
    for r in range(n):
        for c in range(n):
            if m[r][c] and not inF(r, c) and not inL(r, c):
                cx = (pad + c*cell + cell/2) * SS; cy = (pad + r*cell + cell/2) * SS; rad = cell*0.48*SS
                d.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], fill=color)
    finder(0, 0); finder(0, n-7); finder(n-7, 0)
    zone = lm*cell*SS; zx = X(ls); zy = X(ls)
    d.rounded_rectangle([zx, zy, zx+zone, zy+zone], radius=zone*0.2, fill='white')
    ins = zone*0.1
    lg = Image.open(logo).convert('RGBA').resize((int(zone-2*ins),)*2, Image.LANCZOS)
    mask = Image.new('L', lg.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0,0,lg.size[0]-1,lg.size[1]-1], radius=lg.size[0]*0.16, fill=255)
    im.paste(lg, (int(zx+ins), int(zy+ins)), Image.composite(lg.split()[3], Image.new('L', lg.size, 0), mask))
    return im.resize((W, W), Image.LANCZOS)

if __name__ == '__main__':
    import cv2, numpy as np
    img = styled_qr('https://sclf.occph.com')
    img.save('/tmp/qr_test.png')
    arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    val, pts, _ = cv2.QRCodeDetector().detectAndDecode(arr)
    print('decoded:', repr(val))
    # also decode a downscaled print-size version (~26mm @ 300dpi ≈ 307px) 
    small = cv2.resize(arr, (307, 307), interpolation=cv2.INTER_AREA)
    print('small decoded:', repr(cv2.QRCodeDetector().detectAndDecode(small)[0]))
