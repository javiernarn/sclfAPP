import { roleAndName } from './roleLabel';

// Plain-language labels used by the asset pages (detail + history).
export const ASSET_STATUS_LABELS = {
    in_storage: 'In storage',
    assigned: 'Checked out',
    in_repair: 'In repair',
    retired: 'Retired',
    lost: 'Lost',
};

export const assetStatusLabel = (status) => ASSET_STATUS_LABELS[status] || (status ? status.replace(/_/g, ' ') : '—');

export const assetStatusBadgeClass = (status) => {
    switch (status) {
        case 'assigned': return 'ds-badge ds-badge-found';
        case 'in_repair': return 'ds-badge ds-badge-pending';
        case 'lost': return 'ds-badge ds-badge-rejected';
        default: return 'ds-badge ds-badge-default';
    }
};

export const MOVEMENT_TITLES = {
    registered: 'Registered',
    assigned: 'Checked out',
    unassigned: 'Returned to storage',
    sent_for_repair: 'Sent for repair',
    returned_from_repair: 'Repair finished',
    retired: 'Retired',
    reported_lost: 'Reported lost',
    details_updated: 'Details edited',
    deleted: 'Deleted from registry',
};

// History rows written before the status trail existed have no to_status;
// the action alone says where the asset ended up.
const STATUS_AFTER_ACTION = {
    registered: 'in_storage',
    assigned: 'assigned',
    unassigned: 'in_storage',
    sent_for_repair: 'in_repair',
    returned_from_repair: 'in_storage',
    retired: 'retired',
    reported_lost: 'lost',
};

export const movementToStatus = (m) => m.to_status || STATUS_AFTER_ACTION[m.action] || null;

// Older rows stored "Registered by Jane." / "Details edited by Jane." as the
// note, which just repeated the "done by" column. Hide those.
const AUTO_NOTE = /^(Registered|Details edited|Deleted from registry) by .+\.$/;
export const movementNote = (m) => (m.notes && !AUTO_NOTE.test(m.notes.trim()) ? m.notes : '');

// One sentence saying exactly what happened, e.g.
// "Checked out to Student Jessa Alfeche (was with Staff Ana Cruz)".
export function describeMovement(m) {
    const to = m.to_user ? roleAndName(m.to_user) : '';
    const from = m.from_user ? roleAndName(m.from_user) : '';

    switch (m.action) {
        case 'registered': return 'Added to the asset registry.';
        case 'assigned': return to ? `Checked out to ${to}${from ? ` (was with ${from})` : ''}.` : 'Checked out.';
        case 'unassigned': return from ? `Returned to storage by ${from}.` : 'Returned to storage.';
        case 'sent_for_repair': return from ? `Sent for repair (was with ${from}).` : 'Sent for repair.';
        case 'returned_from_repair': return 'Repair finished — back in storage.';
        case 'retired': return 'Retired — no longer in use.';
        case 'reported_lost': return from ? `Reported lost (last held by ${from}).` : 'Reported lost.';
        case 'details_updated': return 'Registry details were edited.';
        case 'deleted': return 'Removed from the registry.';
        default: return m.action;
    }
}
