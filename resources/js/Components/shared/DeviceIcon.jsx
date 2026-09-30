import React from 'react';
import { Smartphone, Tablet, Monitor, Bot } from '../icons';

const ICONS = {
    mobile: Smartphone,
    tablet: Tablet,
    desktop: Monitor,
    bot: Bot,
    unknown: Monitor,
};

export default function DeviceIcon({ deviceType, size = 16, ...rest }) {
    const Icon = ICONS[deviceType] || Monitor;
    return <Icon size={size} {...rest} />;
}
