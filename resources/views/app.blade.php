@php
    // Route passes $seo (see App\Support\Seo); fall back for any other caller of view('app').
    $seo = $seo ?? \App\Support\Seo::forRequest(request());
    $sclfTheme = request()->cookie('sclf-theme', 'white');
    // 'dark-blue' / 'dark-yellow' / 'dark-maroon' (Custom themes) are dark shells.
    $sclfTheme = in_array($sclfTheme, ['black', 'dark-white', 'dark-blue', 'dark-yellow', 'dark-maroon']) ? 'black' : 'white';
    $sclfThemeColor = $sclfTheme === 'black' ? '#0a0c12' : '#ffffff';
    // PWA title bar / browser toolbar color: navy on light themes, white on dark themes.
    $sclfBarColor = $sclfTheme === 'black' ? '#ffffff' : '#01215f';
    $sclfStatusBarStyle = $sclfTheme === 'black' ? 'black' : 'default';
@endphp
<!DOCTYPE html>
<html lang="en" data-theme="{{ $sclfTheme === 'black' ? 'black' : '' }}" style="background:{{ $sclfThemeColor }}; overscroll-behavior-y: none; touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; text-size-adjust: 100%;">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <!-- CSRF -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <!-- Title / SEO -->
    <title>{{ $seo['title'] }}</title>
    <meta name="description" content="{{ $seo['description'] }}">
    <meta name="robots" content="{{ $seo['robots'] }}">
    <meta name="application-name" content="SCLF - Opol Community College">
    <meta name="author" content="Opol Community College">
    <meta name="keywords" content="SCLF, Opol Community College, Lost and Found, OCC Lost and Found, Campus Lost and Found, report lost item, claim found item">
    @if ($seo['canonical'])
    <link rel="canonical" href="{{ $seo['canonical'] }}">
    @endif

    <!-- Open Graph / social preview -->
    <meta property="og:type" content="website">
    <meta property="og:locale" content="en_PH">
    <meta property="og:site_name" content="SCLF - Opol Community College">
    <meta property="og:title" content="{{ $seo['title'] }}">
    <meta property="og:description" content="{{ $seo['description'] }}">
    <meta property="og:url" content="{{ $seo['canonical'] ?? $seo['base'] . '/' }}">
    <meta property="og:image" content="{{ $seo['image'] }}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{{ $seo['imageAlt'] }}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $seo['title'] }}">
    <meta name="twitter:description" content="{{ $seo['description'] }}">
    <meta name="twitter:image" content="{{ $seo['image'] }}">
    <meta name="twitter:image:alt" content="{{ $seo['imageAlt'] }}">

    @if ($seo['jsonLd'])
    <!-- Structured data (public pages only) -->
    <script type="application/ld+json">{!! json_encode($seo['jsonLd'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    @endif

    <!-- Favicons / home-screen icons -->
    <link rel="icon" href="{{ asset('favicon.ico') }}" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('images/favicon-32.png') }}">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ asset('images/favicon-16.png') }}">
    <link rel="icon" type="image/png" sizes="192x192" href="{{ asset('images/icon-192.png') }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ asset('images/apple-touch-icon.png') }}">

    <!-- PWA (installable on Android / iOS / Windows / macOS / ChromeOS / Linux) -->
    <meta name="theme-color" content="{{ $sclfBarColor }}">
    <meta name="msapplication-TileColor" content="#01215f">
    <meta name="msapplication-TileImage" content="{{ asset('images/icon-192.png') }}">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="SCLF">
    <meta name="apple-mobile-web-app-status-bar-style" content="{{ $sclfStatusBarStyle }}">
    <meta name="format-detection" content="telephone=no">
    <!-- use-credentials: the manifest varies with the "sclf-theme" cookie, and browsers
         fetch manifests WITHOUT cookies unless this is set. -->
    <link rel="manifest" href="{{ route('pwa.manifest') }}" crossorigin="use-credentials">

    <!-- iOS zooms the page when a field with text smaller than 16px gets focus.
         On touch screens keep every text field at 16px so tapping one never zooms. -->
    <style>
        @media (pointer: coarse) {
            input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]):not([type="button"]):not([type="submit"]),
            select,
            textarea {
                font-size: 16px !important;
            }
        }
    </style>

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">

    @viteReactRefresh
    @vite('resources/js/main.jsx')
</head>
<body style="margin:0; background:{{ $sclfThemeColor }}; overscroll-behavior-y: none; touch-action: pan-x pan-y; min-height: 100vh; min-height: 100dvh;">
    <div id="app"></div>
    <noscript>
        <div style="font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #111; background: #fff;">
            <h1>SCLF - Opol Community College</h1>
            <p>{{ $seo['description'] }}</p>
            <p>JavaScript is required to use SCLF. Please enable JavaScript in your browser, then reload this page.</p>
        </div>
    </noscript>
</body>
</html>
