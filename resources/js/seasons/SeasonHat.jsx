import React from 'react';
import useSeason from './useSeason';
import { HW, XM, NY } from './art';

// A small seasonal sticker that perches on a logo (a jack-o'-lantern for
// Halloween, Santa for Christmas, a party face for New Year). Real Noto Emoji artwork, not hand-drawn.
// Put it inside a position:relative wrapper around the logo.
export default function SeasonHat({ className = '' }) {
    const season = useSeason();
    const src = season === 'halloween' ? HW.pumpkin : season === 'christmas' ? XM.santa : season === 'newyear' ? NY.partyface : null;
    if (!src) return null;
    return <img className={`sx-hat ${className}`} src={src} alt="" draggable="false" aria-hidden="true" />;
}
