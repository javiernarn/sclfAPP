// Save a file in a way that works on every phone, tablet and desktop.
//
// Why not just <a download>? On iPhone/iPad a blob download of a .txt opens a
// "preview" sheet (the "See more / Open in Docs" screen). Instead we hand the
// file to the system share sheet, which offers "Save to Files", "Copy",
// AirDrop, Drive, etc. — on iOS AND Android. Desktop (or any browser without
// file sharing) falls back to a normal download.

const canShareFile = (file) => {
    try {
        return typeof navigator !== 'undefined'
            && typeof navigator.share === 'function'
            && typeof navigator.canShare === 'function'
            && navigator.canShare({ files: [file] });
    } catch (e) {
        return false;
    }
};

const classicDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
};

/**
 * @returns {Promise<'shared'|'downloaded'|'cancelled'>}
 */
export async function saveBlob(blob, filename, { title } = {}) {
    const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

    if (canShareFile(file)) {
        try {
            await navigator.share({ files: [file], title: title || filename });
            return 'shared';
        } catch (err) {
            if (err && err.name === 'AbortError') return 'cancelled'; // user closed the sheet
            // any other failure: fall through to a normal download
        }
    }

    classicDownload(blob, filename);
    return 'downloaded';
}

export const saveText = (text, filename, opts) =>
    saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename, opts);

/** Copy text; works on older iOS/Android webviews too. */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e2) {
            return false;
        }
    }
}

/** Draw the codes onto a PNG so they can be saved to Photos / Files as an image. */
export function codesToPngBlob({ title, subtitle, codes, footer }) {
    const W = 800;
    const rowH = 64;
    const H = 220 + Math.ceil(codes.length / 2) * rowH + 90;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111827';
    ctx.font = '700 36px system-ui, -apple-system, Arial, sans-serif';
    ctx.fillText(title, 40, 70);
    ctx.fillStyle = '#4b5563';
    ctx.font = '22px system-ui, -apple-system, Arial, sans-serif';
    ctx.fillText(subtitle, 40, 112);

    ctx.font = '700 34px ui-monospace, Menlo, Consolas, monospace';
    codes.forEach((c, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 40 + col * 370;
        const y = 170 + row * rowH;
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(x, y, 340, 48);
        ctx.fillStyle = '#111827';
        ctx.fillText(c, x + 20, y + 36);
    });

    ctx.fillStyle = '#b45309';
    ctx.font = '20px system-ui, -apple-system, Arial, sans-serif';
    ctx.fillText(footer, 40, H - 40);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
