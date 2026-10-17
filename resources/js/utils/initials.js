// "Jonee John Antiquina" -> "JJA". Used as the short phrase a person must type
// to confirm a permanent delete (see ConfirmContext `typeToConfirm`).
export function initialsOf(name, fallback = 'DELETE') {
    const letters = String(name || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
    return letters || fallback;
}
