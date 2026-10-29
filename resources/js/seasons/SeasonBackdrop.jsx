import React from 'react';
import useSeason from './useSeason';
import HalloweenScene from './HalloweenScene';
import ChristmasScene from './ChristmasScene';
import NewYearScene from './NewYearScene';
import './seasons.css';

/**
 * <SeasonBackdrop variant="loading|auth|dashboard" isDark />
 * Renders the animated background for the active season (or nothing on the
 * default theme). It is absolutely positioned, never catches clicks, and sits
 * behind the page content.
 */
export default function SeasonBackdrop({ variant = 'auth', isDark = true }) {
    const season = useSeason();
    if (season === 'halloween') return <HalloweenScene variant={variant} isDark={isDark} />;
    if (season === 'christmas') return <ChristmasScene variant={variant} isDark={isDark} />;
    if (season === 'newyear') return <NewYearScene variant={variant} isDark={isDark} />;
    return null;
}
