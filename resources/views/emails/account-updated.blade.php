<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your SCLF Account Was Updated - SCLF</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
            <img src="{{ $message->embed(resource_path('js/assets/images/site-logo.png')) }}" alt="SCLF Logo" style="max-width: 120px; height: auto; margin-bottom: 15px;">
            <h1 style="color: #0f2a5c; margin: 0; font-size: 24px;">Account Updated</h1>
            <p style="color: #666; margin: 5px 0 0;">Student Campus Lost &amp; Found &middot; Opol Community College</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h2 style="color: #0f2a5c; font-size: 20px; margin-bottom: 15px;">Hello {{ $fullName }},</h2>

            @if ($toOldAddress)
                <p>The email address on your SCLF account was changed by <strong>{{ $updatedBy }}</strong>. This notice is sent to your previous address for your security. If you did not expect this, please contact the Administrator.</p>
            @else
                <p>Your SCLF Lost &amp; Found account details were updated by <strong>{{ $updatedBy }}</strong>. Here is what changed:</p>
            @endif

            @if (count($changes))
            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Updated details</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
                    @foreach ($changes as $c)
                    <tr>
                        <td style="padding: 6px 0; color: #666; width: 30%; vertical-align: top;">{{ $c['label'] }}</td>
                        <td style="padding: 6px 0; color: #0f2a5c;">
                            <span style="color: #999; text-decoration: line-through;">{{ $c['old'] ?: '—' }}</span>
                            &rarr; <strong>{{ $c['new'] ?: '—' }}</strong>
                        </td>
                    </tr>
                    @endforeach
                </table>
            </div>
            @endif

            @if ($passwordReset)
                <p>Your password was also reset by the {{ $updatedBy }}. Please sign in with the new password you were given and change it in your profile.</p>
            @endif

            <div style="text-align: center; margin: 25px 0;">
                <a href="{{ $loginUrl }}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-size: 14px;">Sign in to SCLF</a>
            </div>

            <p>If something looks wrong, please contact the Administrator.</p>
        </div>

        <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 5px 0;"><strong>Student Campus Lost &amp; Found &middot; Opol Community College</strong></p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0;">&copy; 2026 Opol Community College. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
