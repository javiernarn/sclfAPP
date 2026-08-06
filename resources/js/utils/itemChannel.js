import { Search, Building2 } from 'lucide-react';

// Single source of truth for how an item's intake_channel renders across
// the Claims list, Claim detail, Found Items list, and Found Item detail
// pages — label, badge color, icon, and description text all keyed off
// the same channel string so the pages can never drift apart or confuse
// users about how the item entered the system.
export const ITEM_CHANNEL = {
    online_report: {
        label: 'Lost & Found',
        badge: 'ds-badge-lostfound',
        icon: Search,
        itemDescription: 'This item was reported found through the Lost & Found system by another user, and is awaiting a match with its owner.',
        claimDescription: 'The found item this claim is for. It was submitted through the Lost & Found system by the person who found it, and is not yet confirmed to belong to you.',
    },
    counter_intake: {
        label: 'Counter',
        badge: 'ds-badge-counter',
        icon: Building2,
        itemDescription: 'This item was turned in directly at the Lost & Found counter and logged by staff, not submitted through an online report.',
        claimDescription: 'The found item this claim is for. It was turned in and logged directly at the counter by staff, not submitted as an online Lost & Found report.',
    },
};

const FALLBACK_CHANNEL = 'online_report';

export const itemChannelLabel = (channel) => ITEM_CHANNEL[channel]?.label || ITEM_CHANNEL[FALLBACK_CHANNEL].label;
export const itemChannelBadgeClass = (channel) => `ds-badge ${ITEM_CHANNEL[channel]?.badge || ITEM_CHANNEL[FALLBACK_CHANNEL].badge}`;
export const itemChannelIcon = (channel) => ITEM_CHANNEL[channel]?.icon || ITEM_CHANNEL[FALLBACK_CHANNEL].icon;
export const itemChannelItemDescription = (channel) => ITEM_CHANNEL[channel]?.itemDescription || ITEM_CHANNEL[FALLBACK_CHANNEL].itemDescription;
export const itemChannelClaimDescription = (channel) => ITEM_CHANNEL[channel]?.claimDescription || ITEM_CHANNEL[FALLBACK_CHANNEL].claimDescription;
