// ---------------------------------------------------------------------------
// Central icon module — app-wide animated icons
// ---------------------------------------------------------------------------
// Every file in the app imports icons from here instead of 'lucide-react'
// directly, under the exact same names, so no call site had to change.
//
// Coverage: ALL icons used across the app animate — on hover, and on
// "active"/selected state (e.g. the current sidebar nav item) via an
// `active` boolean prop.
//
//   <Bell size={18} />                 // hover-animates
//   <LayoutDashboard active={isActive} size={18} />   // animates when isActive flips true
//
// Two tiers, same external API:
//  1. Icons lucide-animated (https://www.npmjs.com/package/lucide-animated)
//     ships natively (~55 of ours) use its built-in hover animation, plus
//     an imperative ref (`startAnimation`/`stopAnimation`) to also fire it
//     whenever `active` becomes true.
//  2. Icons it doesn't ship (~47 — Package/PackageCheck/PackageOpen/
//     PackageSearch/PackageX, Trash2, Tag, LayoutDashboard, ScrollText,
//     QrCode, Pencil, Info, VenetianMask, and others) keep their original
//     lucide-react artwork — the actual glyph shape is unaffected — but get
//     wrapped in a small Motion-driven container that plays a consistent
//     scale/rotate "pop" on hover and on `active`, so the *behavior* is the
//     same app-wide even where the icon set itself doesn't have a bespoke
//     hand-animated version yet.
// ---------------------------------------------------------------------------

import React, { useEffect, useRef } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import {
    BellIcon,
    ArchiveIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    BanIcon,
    BoxesIcon,
    CheckIcon,
    CheckCheckIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    CircleCheckIcon,
    ClipboardCheckIcon,
    ClockIcon,
    CopyIcon,
    DollarSignIcon,
    DownloadIcon,
    ExpandIcon,
    EyeIcon,
    EyeOffIcon,
    FileTextIcon,
    GraduationCapIcon,
    HistoryIcon,
    HourglassIcon,
    IdCardIcon,
    KeyboardIcon,
    LockIcon,
    MapPinIcon,
    MessageSquareIcon,
    MoonIcon,
    PanelLeftCloseIcon,
    PanelLeftOpenIcon,
    PartyPopperIcon,
    PhoneIcon,
    PhoneCallIcon,
    PlusIcon,
    ReceiptIcon,
    RefreshCwIcon,
    RotateCcwIcon,
    RotateCwIcon,
    SearchIcon,
    ShieldCheckIcon,
    SparklesIcon,
    SunIcon,
    UploadIcon,
    UserIcon,
    UserCheckIcon,
    UsersIcon,
    WrenchIcon,
    XIcon,
    LogoutIcon,
    LoaderIcon,
    CircleHelpIcon,
    CircleCheckBigIcon,
} from 'lucide-animated';

// Raw static glyphs from lucide-react, aliased so they don't collide with
// the animated exports of the same name below.
import {
    AlertTriangle as AlertTriangleGlyph,
    ArrowRightLeft as ArrowRightLeftGlyph,
    BellOff as BellOffGlyph,
    Building2 as Building2Glyph,
    Calendar as CalendarGlyph,
    Camera as CameraGlyph,
    ClipboardList as ClipboardListGlyph,
    ExternalLink as ExternalLinkGlyph,
    FlipHorizontal as FlipHorizontalGlyph,
    FlipVertical as FlipVerticalGlyph,
    Gift as GiftGlyph,
    Handshake as HandshakeGlyph,
    Hash as HashGlyph,
    Inbox as InboxGlyph,
    Info as InfoGlyph,
    KeyRound as KeyRoundGlyph,
    LayoutDashboard as LayoutDashboardGlyph,
    LayoutList as LayoutListGlyph,
    ListOrdered as ListOrderedGlyph,
    LogIn as LogInGlyph,
    Mail as MailGlyph,
    Megaphone as MegaphoneGlyph,
    Package as PackageGlyph,
    PackageCheck as PackageCheckGlyph,
    PackageOpen as PackageOpenGlyph,
    PackageSearch as PackageSearchGlyph,
    PackageX as PackageXGlyph,
    Palette as PaletteGlyph,
    Pencil as PencilGlyph,
    PlayCircle as PlayCircleGlyph,
    QrCode as QrCodeGlyph,
    ScrollText as ScrollTextGlyph,
    ShieldAlert as ShieldAlertGlyph,
    ShieldOff as ShieldOffGlyph,
    Smartphone as SmartphoneGlyph,
    Table2 as Table2Glyph,
    Tag as TagGlyph,
    Trash2 as Trash2Glyph,
    UserCircle as UserCircleGlyph,
    UserPlus as UserPlusGlyph,
    UserX as UserXGlyph,
    VenetianMask as VenetianMaskGlyph,
    XCircle as XCircleGlyph,
    ZoomIn as ZoomInGlyph,
    ZoomOut as ZoomOutGlyph,
    Image as ImageGlyph,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Tier 1: native lucide-animated icons
// ---------------------------------------------------------------------------
// Wraps an animated icon so lucide-react-only SVG props (chiefly
// `strokeWidth`, which several pages still pass) don't leak through onto
// lucide-animated's wrapping <div>, and so an `active` prop fires the same
// animation the icon already plays on hover.
function withAnimated(AnimatedIcon) {
    const Wrapped = React.forwardRef(function AnimatedIconWrapper(props, ref) {
        // eslint-disable-next-line no-unused-vars
        const { strokeWidth, absoluteStrokeWidth, active, ...rest } = props;
        const innerRef = useRef(null);
        useEffect(() => {
            if (active) innerRef.current?.startAnimation?.();
        }, [active]);
        return (
            <AnimatedIcon
                ref={(node) => {
                    innerRef.current = node;
                    if (typeof ref === 'function') ref(node);
                    else if (ref) ref.current = node;
                }}
                {...rest}
            />
        );
    });
    Wrapped.displayName = `Animated(${AnimatedIcon.displayName || AnimatedIcon.name || 'Icon'})`;
    return Wrapped;
}

export const Bell = withAnimated(BellIcon);
export const Archive = withAnimated(ArchiveIcon);
export const ArrowLeft = withAnimated(ArrowLeftIcon);
export const ArrowRight = withAnimated(ArrowRightIcon);
export const Ban = withAnimated(BanIcon);
export const Boxes = withAnimated(BoxesIcon);
export const Check = withAnimated(CheckIcon);
export const CheckCheck = withAnimated(CheckCheckIcon);
export const ChevronDown = withAnimated(ChevronDownIcon);
export const ChevronLeft = withAnimated(ChevronLeftIcon);
export const ChevronRight = withAnimated(ChevronRightIcon);
export const ChevronUp = withAnimated(ChevronUpIcon);
export const CircleCheck = withAnimated(CircleCheckIcon);
export const ClipboardCheck = withAnimated(ClipboardCheckIcon);
export const Clock = withAnimated(ClockIcon);
export const Copy = withAnimated(CopyIcon);
export const DollarSign = withAnimated(DollarSignIcon);
export const Download = withAnimated(DownloadIcon);
export const Expand = withAnimated(ExpandIcon);
export const Eye = withAnimated(EyeIcon);
export const EyeOff = withAnimated(EyeOffIcon);
export const FileText = withAnimated(FileTextIcon);
export const GraduationCap = withAnimated(GraduationCapIcon);
export const History = withAnimated(HistoryIcon);
export const Hourglass = withAnimated(HourglassIcon);
export const IdCard = withAnimated(IdCardIcon);
export const Keyboard = withAnimated(KeyboardIcon);
export const Lock = withAnimated(LockIcon);
export const MapPin = withAnimated(MapPinIcon);
export const MessageSquare = withAnimated(MessageSquareIcon);
export const Moon = withAnimated(MoonIcon);
export const PanelLeftClose = withAnimated(PanelLeftCloseIcon);
export const PanelLeftOpen = withAnimated(PanelLeftOpenIcon);
export const PartyPopper = withAnimated(PartyPopperIcon);
export const Phone = withAnimated(PhoneIcon);
export const PhoneCall = withAnimated(PhoneCallIcon);
export const Plus = withAnimated(PlusIcon);
export const Receipt = withAnimated(ReceiptIcon);
export const RefreshCw = withAnimated(RefreshCwIcon);
export const RotateCcw = withAnimated(RotateCcwIcon);
export const RotateCw = withAnimated(RotateCwIcon);
export const Search = withAnimated(SearchIcon);
export const ShieldCheck = withAnimated(ShieldCheckIcon);
export const Sparkles = withAnimated(SparklesIcon);
export const Sun = withAnimated(SunIcon);
export const Upload = withAnimated(UploadIcon);
export const User = withAnimated(UserIcon);
export const UserCheck = withAnimated(UserCheckIcon);
export const Users = withAnimated(UsersIcon);
export const Wrench = withAnimated(WrenchIcon);
export const X = withAnimated(XIcon);
// Renamed in lucide-animated's own catalog (kept under the lucide-react
// name here so no import site needed to change):
export const LogOut = withAnimated(LogoutIcon);
export const Loader2 = withAnimated(LoaderIcon);
export const HelpCircle = withAnimated(CircleHelpIcon);
export const CheckCircle2 = withAnimated(CircleCheckBigIcon);

// ---------------------------------------------------------------------------
// Tier 2: static lucide-react glyphs, wrapped for the same hover/active
// animation behavior lucide-animated icons get natively.
// ---------------------------------------------------------------------------
// A single restrained "pop": scale + a few degrees of rotation. Deliberately
// subtle and short (180ms) to match lucide-animated's own hover feel rather
// than introduce a second, louder animation style alongside it.
const popVariants = {
    rest: { scale: 1, rotate: 0 },
    active: { scale: [1, 1.18, 1], rotate: [0, -8, 0], transition: { duration: 0.35, ease: 'easeInOut' } },
};

function animatedStatic(Glyph, displayName) {
    const Wrapped = React.forwardRef(function StaticAnimatedIcon(props, ref) {
        const { active, size = 24, className, style, strokeWidth, ...rest } = props;
        const controls = useAnimationControls();

        useEffect(() => {
            if (active) controls.start('active');
        }, [active, controls]);

        return (
            <motion.span
                ref={ref}
                className={className}
                style={{ display: 'inline-flex', lineHeight: 0, ...style }}
                variants={popVariants}
                initial="rest"
                animate={controls}
                whileHover="active"
                onHoverEnd={() => controls.start('rest')}
                {...rest}
            >
                <Glyph size={size} strokeWidth={strokeWidth} />
            </motion.span>
        );
    });
    Wrapped.displayName = `AnimatedStatic(${displayName})`;
    return Wrapped;
}

export const AlertTriangle = animatedStatic(AlertTriangleGlyph, 'AlertTriangle');
export const ArrowRightLeft = animatedStatic(ArrowRightLeftGlyph, 'ArrowRightLeft');
export const BellOff = animatedStatic(BellOffGlyph, 'BellOff');
export const Building2 = animatedStatic(Building2Glyph, 'Building2');
export const Calendar = animatedStatic(CalendarGlyph, 'Calendar');
export const Camera = animatedStatic(CameraGlyph, 'Camera');
export const ClipboardList = animatedStatic(ClipboardListGlyph, 'ClipboardList');
export const ExternalLink = animatedStatic(ExternalLinkGlyph, 'ExternalLink');
export const FlipHorizontal = animatedStatic(FlipHorizontalGlyph, 'FlipHorizontal');
export const FlipVertical = animatedStatic(FlipVerticalGlyph, 'FlipVertical');
export const Gift = animatedStatic(GiftGlyph, 'Gift');
export const Handshake = animatedStatic(HandshakeGlyph, 'Handshake');
export const Hash = animatedStatic(HashGlyph, 'Hash');
export const Inbox = animatedStatic(InboxGlyph, 'Inbox');
export const Info = animatedStatic(InfoGlyph, 'Info');
export const KeyRound = animatedStatic(KeyRoundGlyph, 'KeyRound');
export const LayoutDashboard = animatedStatic(LayoutDashboardGlyph, 'LayoutDashboard');
export const LayoutList = animatedStatic(LayoutListGlyph, 'LayoutList');
export const ListOrdered = animatedStatic(ListOrderedGlyph, 'ListOrdered');
export const LogIn = animatedStatic(LogInGlyph, 'LogIn');
export const Mail = animatedStatic(MailGlyph, 'Mail');
export const Megaphone = animatedStatic(MegaphoneGlyph, 'Megaphone');
export const Package = animatedStatic(PackageGlyph, 'Package');
export const PackageCheck = animatedStatic(PackageCheckGlyph, 'PackageCheck');
export const PackageOpen = animatedStatic(PackageOpenGlyph, 'PackageOpen');
export const PackageSearch = animatedStatic(PackageSearchGlyph, 'PackageSearch');
export const PackageX = animatedStatic(PackageXGlyph, 'PackageX');
export const Palette = animatedStatic(PaletteGlyph, 'Palette');
export const Pencil = animatedStatic(PencilGlyph, 'Pencil');
export const PlayCircle = animatedStatic(PlayCircleGlyph, 'PlayCircle');
export const QrCode = animatedStatic(QrCodeGlyph, 'QrCode');
export const ScrollText = animatedStatic(ScrollTextGlyph, 'ScrollText');
export const ShieldAlert = animatedStatic(ShieldAlertGlyph, 'ShieldAlert');
export const ShieldOff = animatedStatic(ShieldOffGlyph, 'ShieldOff');
export const Smartphone = animatedStatic(SmartphoneGlyph, 'Smartphone');
export const Table2 = animatedStatic(Table2Glyph, 'Table2');
export const Tag = animatedStatic(TagGlyph, 'Tag');
export const Trash2 = animatedStatic(Trash2Glyph, 'Trash2');
export const UserCircle = animatedStatic(UserCircleGlyph, 'UserCircle');
export const UserPlus = animatedStatic(UserPlusGlyph, 'UserPlus');
export const UserX = animatedStatic(UserXGlyph, 'UserX');
export const VenetianMask = animatedStatic(VenetianMaskGlyph, 'VenetianMask');
export const XCircle = animatedStatic(XCircleGlyph, 'XCircle');
export const ZoomIn = animatedStatic(ZoomInGlyph, 'ZoomIn');
export const ZoomOut = animatedStatic(ZoomOutGlyph, 'ZoomOut');
export const Image = animatedStatic(ImageGlyph, 'Image');
