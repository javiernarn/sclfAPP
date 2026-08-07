import {
    Clock,
    Search,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Ban,
    PackageCheck,
    PartyPopper,
} from 'lucide-react';

// Single source of truth for how a claim status renders across the Claims
// list and the Claim detail page — label, badge color, and icon all keyed
// off the same status string so the two pages can never drift apart
export const CLAIM_STATUS = {
    pending: { label: 'Pending', badge: 'ds-badge-pending', icon: Clock },
    under_review: { label: 'Under Review', badge: 'ds-badge-review', icon: Search },
    more_evidence_required: { label: 'More Evidence Required', badge: 'ds-badge-pending', icon: AlertTriangle },
    approved: { label: 'Approved', badge: 'ds-badge-found', icon: CheckCircle2 },
    rejected: { label: 'Rejected', badge: 'ds-badge-rejected', icon: XCircle },
    cancelled: { label: 'Cancelled', badge: 'ds-badge-default', icon: Ban },
    release_pending: { label: 'Ready for Release', badge: 'ds-badge-claimed', icon: PackageCheck },
    released: { label: 'Released', badge: 'ds-badge-default', icon: PartyPopper },
};

export const claimStatusLabel = (status) => CLAIM_STATUS[status]?.label || status;
export const claimStatusBadgeClass = (status) => `ds-badge ${CLAIM_STATUS[status]?.badge || 'ds-badge-default'}`;
export const claimStatusIcon = (status) => CLAIM_STATUS[status]?.icon || Clock;
