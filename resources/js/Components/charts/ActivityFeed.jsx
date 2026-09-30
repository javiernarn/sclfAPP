import React, { useEffect, useState } from 'react';
import { ClipboardList, PackageSearch, Boxes, Handshake } from '../icons';
import { timeAgo, humanize } from './utils';

const META = {
    lost: { icon: ClipboardList, label: 'Lost report', tone: 'is-lost' },
    found: { icon: PackageSearch, label: 'Found report', tone: 'is-found' },
    counter: { icon: Boxes, label: 'Counter check-in', tone: 'is-counter' },
    claim: { icon: Handshake, label: 'Claim filed', tone: 'is-claim' },
};

/** Live feed — new rows slide in when a poll brings them. */
export default function ActivityFeed({ items = [] }) {
    const [, tick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => tick((n) => n + 1), 15000);
        return () => clearInterval(t);
    }, []);
    if (!items.length) return <p className="ch-empty">No activity yet</p>;
    return (
        <ul className="ch-feed">
            {items.map((e) => {
                const meta = META[e.type] || META.lost;
                const Icon = meta.icon;
                return (
                    <li key={`${e.type}-${e.title}-${e.at}`} className="ch-feed-item">
                        <span className={`ch-feed-icon ${meta.tone}`}><Icon size={15} strokeWidth={2} /></span>
                        <div className="ch-feed-body">
                            <b>{e.title}</b>
                            <span>{meta.label}{e.status ? ` · ${humanize(e.status)}` : ''}</span>
                        </div>
                        <time>{timeAgo(e.at)}</time>
                    </li>
                );
            })}
        </ul>
    );
}
