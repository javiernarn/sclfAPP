@php
    // Fixed, high-contrast role colours (white text on solid fill) so a role is
    // recognisable at a glance in any mail client, light or dark.
    $roleColors = ['admin'=>'#b91c1c','administrator'=>'#b91c1c','staff'=>'#6d28d9','security officer'=>'#b45309','security'=>'#b45309','instructor'=>'#0369a1','student'=>'#047857'];
    $rolePill = function ($label) use ($roleColors) {
        $bg = $roleColors[strtolower(trim((string) $label))] ?? '#475569';
        return new \Illuminate\Support\HtmlString('<span style="display:inline-block;background-color:'.$bg.';color:#ffffff;font-weight:bold;padding:1px 10px;border-radius:999px;font-size:13px;">'.e($label).'</span>');
    };
    $highlight = function ($text) use ($roleColors) {
        $safe = e((string) $text);
        $words = ['security officers'=>'security officer','security officer'=>'security officer','administrators'=>'admin','administrator'=>'admin','instructors'=>'instructor','instructor'=>'instructor','students'=>'student','student'=>'student','admin'=>'admin','staff'=>'staff'];
        $keys = ['approved'=>'#047857','claimed'=>'#047857','released'=>'#047857','resolved'=>'#047857','pending'=>'#b45309','unclaimed'=>'#b45309','rejected'=>'#b91c1c','denied'=>'#b91c1c','expired'=>'#b91c1c','verified'=>'#0369a1','matched'=>'#0369a1'];
        $all = array_merge(array_keys($words), array_keys($keys));
        usort($all, fn ($a, $b) => strlen($b) <=> strlen($a));
        $alt = implode('|', array_map(fn ($w) => preg_quote($w, '/'), $all));
        $out = preg_replace_callback('/\b('.$alt.')\b/i', function ($m) use ($words, $keys, $roleColors) {
            $k = strtolower($m[1]);
            $bg = isset($words[$k]) ? ($roleColors[$words[$k]] ?? '#475569') : $keys[$k];
            return '<span style="display:inline-block;background-color:'.$bg.';color:#ffffff;font-weight:bold;padding:0 8px;border-radius:999px;font-size:13px;">'.$m[1].'</span>';
        }, $safe);
        return new \Illuminate\Support\HtmlString($out);
    };
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your new email - SCLF</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <!-- Header: embedded logo, same format as verify-email.blade.php -->
        <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
            <img src="{{ $message->embed(resource_path('js/assets/images/site-logo.png')) }}" alt="SCLF Logo" style="max-width: 120px; height: auto; margin-bottom: 15px;">
            <h1 style="color: #0f2a5c; margin: 0; font-size: 24px;">Confirm Your New Email</h1>
            <p style="color: #666; margin: 5px 0 0;">Student Campus Lost &amp; Found &middot; Opol Community College</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h2 style="color: #0f2a5c; font-size: 20px; margin-bottom: 15px;">Hello {{ $fullName }},</h2>

            <p>We received a request to change the email address on your SCLF account. To finish, type the 6-digit code below into the <strong>Change email</strong> form on your Profile page.</p>

            <div style="text-align: center; margin: 25px 0 5px;">
                <p style="margin: 0 0 8px; font-size: 14px; color: #666;">Your confirmation code</p>
                <div style="display: inline-block; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 28px; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f2a5c; font-family: 'Courier New', monospace;">{{ $code }}</div>
            </div>

            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 25px 0 20px;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Email change</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 6px 0; color: #666; width: 30%; vertical-align: top;">Current</td>
                        <td style="padding: 6px 0; color: #999; text-decoration: line-through; word-break: break-all;">{{ $oldEmail }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">New</td>
                        <td style="padding: 6px 0; color: #0f2a5c; word-break: break-all;"><strong>{{ $newEmail }}</strong></td>
                    </tr>
                </table>
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 12px;">
                <strong>⏳ Code Expiration</strong>
                <p style="margin: 10px 0 0; font-size: 14px;">This code will expire in <strong>{{ $minutes }} minutes</strong> for security purposes. If it expires, go back to your Profile page and request a new one.</p>
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 12px;">
                <strong>🔒 Security Notice</strong>
                <p style="margin: 10px 0 0; font-size: 14px;">Never share this code with anyone. If you did not ask to change your email, you can safely ignore this message &mdash; your account email stays the same &mdash; and we recommend changing your password.</p>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>

            <!-- Admin contact block, same format as verify-email.blade.php -->
            <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; font-size: 14px; color: #333;">
                <strong>SCLF Desk</strong><br>
                <span>Opol Community College </span><br>
                {{ $rolePill("Admin") }}
            </div>
        </div>

        <!-- Footer: same format as verify-email.blade.php -->
        <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 5px 0;"><strong>Student Campus Lost &amp; Found &middot; Opol Community College</strong></p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0;">&copy; 2026 Opol Community College. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
