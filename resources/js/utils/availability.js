import axios from '../config/axiosConfig';

/**
 * Asks the backend whether `value` is already taken for `field`
 * ('email' | 'phone_number' | 'student_id') before the person finishes
 * the whole form — this is what lets Register block "Next" the moment a
 * phone number/email/student ID collides with an existing account,
 * instead of only finding out after every step is filled in.
 *
 * Fails "open" (treats as available) on a network error so a flaky
 * connection can't trap someone on a step forever — the final submit
 * still re-validates server-side regardless.
 */
export async function checkAvailability(field, value) {
    if (!value) return true;
    try {
        const res = await axios.post('/check-availability', { field, value }, { silent: true, skipAuthRedirect: true });
        return !!res.data?.available;
    } catch (e) {
        return true;
    }
}
