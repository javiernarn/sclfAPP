<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $notifTitle }} - SCLF</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <!-- Header: embedded logo, top border tinted by the notification's tone (same format as password-reset.blade.php, just an accent color instead of the fixed brand indigo) -->
        <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
            <img src="{{ $message->embed(resource_path('js/assets/images/site-logo.png')) }}" alt="SCLF Logo" style="max-width: 120px; height: auto; margin-bottom: 15px;">
            <div style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #2563eb; border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px;">{{ $badge }}</div>
            <h1 style="color: #0f2a5c; margin: 0; font-size: 24px;">{{ $notifTitle }}</h1>
            <p style="color: #666; margin: 5px 0 0;">Student Campus Lost &amp; Found &middot; Opol Community College</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h2 style="color: #0f2a5c; font-size: 20px; margin-bottom: 15px;">Hello {{ $fullName }},</h2>

            <div style="background-color: #eff6ff; border: 1px solid #2563eb; padding: 15px; margin: 0 0 25px; border-radius: 12px;">
                <p style="margin: 0; font-size: 15px;">{{ $body }}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ $actionUrl }}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Login to View</a>
            </div>

            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Button not working?</h3>
                <p style="font-size: 13px; margin-bottom: 10px;">Copy and paste the link below into your browser:</p>
                <div style="background-color: #eff6ff; padding: 12px; border-radius: 4px; word-break: break-all;">
                    <a href="{{ $actionUrl }}" style="color: #2563eb; text-decoration: none; font-size: 13px;">{{ $actionUrl }}</a>
                </div>
            </div>

            <p style="font-size: 13px; color: #666;">You're receiving this because notifications are turned on for your SCLF account. You can review every notification, read or unread, from the Notifications page once you're signed in.</p>

            <!-- Admin contact block, same format as password-reset.blade.php -->
            <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; font-size: 14px; color: #333;">
                <strong>SCLF Desk Administrator</strong><br>
                <span>Opol Community College </span><br>
                <em>Administrator</em>
            </div>
        </div>

        <!-- Footer: same format as password-reset.blade.php -->
        <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 5px 0;"><strong>Student Campus Lost &amp; Found &middot; Opol Community College</strong></p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0;">&copy; 2026 Opol Community College. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
