import React from 'react';
import { useTween } from './useTween';
import { fmt } from './utils';

// Counts up to (and between) values — used for every KPI number.
export default function AnimatedNumber({ value, decimals = 0, suffix = '', prefix = '' }) {
    const [v] = useTween([Number(value) || 0], 900);
    return <>{prefix}{fmt(v, decimals)}{suffix}</>;
}
