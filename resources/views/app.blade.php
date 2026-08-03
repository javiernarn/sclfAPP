@php
    $sclfTheme = request()->cookie('sclf-theme', 'white');
    $sclfTheme = in_array($sclfTheme, ['black', 'white']) ? $sclfTheme : 'white';
    $sclfThemeColor = $sclfTheme === 'black' ? '#0a0c12' : '#ffffff';
    $sclfStatusBarStyle = $sclfTheme === 'black' ? 'black' : 'default';
@endphp
<!DOCTYPE html>
<html lang="en" data-theme="{{ $sclfTheme === 'black' ? 'black' : '' }}" style="background:{{ $sclfThemeColor }}; overscroll-behavior-y: none;">

<head>
    <meta charset="UTF-8">
    <meta name="viewport"  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
    <!-- CSRF -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <!-- Title / SEO -->
    <title>SCLF - Opol Community College</title>
    <meta name="description" content="Smart Campus Lost & Found system for Opol Community College.">
    <meta name="application-name" content="SCLF - Opol Community College">

    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="32x32" href="{{ asset('images/site-logo.png') }}">
    <link rel="icon" type="image/png" sizes="192x192" href="{{ asset('images/site-logo.png') }}">
    <link rel="shortcut icon" href="{{ asset('images/site-logo.png') }}">
    <link rel="apple-touch-icon" href="{{ asset('images/site-logo.png') }}">

    <!-- PWA -->
    <meta name="theme-color" content="{{ $sclfThemeColor }}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="SCLF">
    <meta name="apple-mobile-web-app-status-bar-style" content="{{ $sclfStatusBarStyle }}">
    <link rel="manifest" href="{{ route('pwa.manifest') }}">

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">

    @viteReactRefresh
    @vite('resources/js/main.jsx')
</head>
<body style="margin:0; background:{{ $sclfThemeColor }}; overscroll-behavior-y: none; min-height: 100vh; min-height: 100dvh;">
    <div id="app"></div>
</body>
</html>
