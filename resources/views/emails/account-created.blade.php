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
    <title>Your SCLF Account - SCLF</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        <!-- Header: embedded OCC/SCLF logo so people recognise who the email is from -->
        <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
            <img src="{{ $message->embed(resource_path('js/assets/images/site-logo.png')) }}" alt="SCLF Logo" style="max-width: 120px; height: auto; margin-bottom: 15px;">
            <h1 style="color: #0f2a5c; margin: 0; font-size: 24px;">Welcome to SCLF</h1>
            <p style="color: #666; margin: 5px 0 0;">Student Campus Lost &amp; Found &middot; Opol Community College</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h2 style="color: #0f2a5c; font-size: 20px; margin-bottom: 15px;">Hello {{ $fullName }},</h2>

            <p>An account has been created for you on the SCLF Lost &amp; Found system by {{ $highlight($createdBy) }}. Your account details are below, together with a temporary password so you can sign in for the first time.</p>

            <!-- Account details -->
            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Your account details</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
                    <tr>
                        <td style="padding: 6px 0; color: #666; width: 38%; vertical-align: top;">Full name</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $fullName }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Email</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c; word-break: break-all;">{{ $email }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Role</td>
                        <td style="padding: 6px 0; ">{{ $rolePill($roleLabel) }}</td>
                    </tr>
                    @if($staffId)
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">ID number</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $staffId }}</td>
                    </tr>
                    @endif
                    @if($campusName)
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Campus</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $campusName }}</td>
                    </tr>
                    @endif
                    @if($phoneNumber)
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Phone</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $phoneNumber }}</td>
                    </tr>
                    @endif
                    @if($genderLabel)
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Gender</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $genderLabel }}</td>
                    </tr>
                    @endif
                    @if(!empty($teachingCourse))
                    <tr>
                        <td style="padding: 6px 0; color: #666; vertical-align: top;">Course you teach</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f2a5c;">{{ $teachingCourse }}</td>
                    </tr>
                    @endif
                </table>
            </div>

            <!-- Sign-in credentials -->
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 18px; margin: 20px 0; border-radius: 12px;">
                <strong>🔑 Your sign-in details</strong>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px; margin-top: 10px;">
                    <tr>
                        <td style="padding: 5px 0; color: #666; width: 38%; vertical-align: top;">Email</td>
                        <td style="padding: 5px 0; word-break: break-all;">{{ $email }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 5px 0; color: #666; vertical-align: top;">Temporary password</td>
                        <td style="padding: 5px 0;">
                            <span style="display: inline-block; background-color: #ffffff; border: 1px dashed #2563eb; border-radius: 6px; padding: 4px 10px; font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: bold; color: #0f2a5c; word-break: break-all;">{{ $temporaryPassword }}</span>
                        </td>
                    </tr>
                </table>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{{ $loginUrl }}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Sign In to SCLF</a>
            </div>

            <!-- What happens next -->
            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 12px;">
                <strong>📋 What happens next</strong>
                <ol style="margin: 10px 0 0; padding-left: 20px; font-size: 14px;">
                    <li>Sign in with the email and temporary password above.</li>
                    <li>You will be asked to finish setting up your account: add your photo, confirm your name and ID, and <strong>choose your own password</strong>.</li>
                    <li>Your temporary password stops working once you have done that.</li>
                </ol>
            </div>

            <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; margin: 20px 0; border-radius: 12px;">
                <strong>🔒 Security Notice</strong>
                <p style="margin: 10px 0 0; font-size: 14px;">Please don't share this email or the temporary password with anyone, and delete this email after you have set your own password. If you were not expecting this account, please ignore this email or contact the SCLF Desk.</p>
            </div>

            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Button not working?</h3>
                <p style="font-size: 13px; margin-bottom: 10px;">Copy and paste the link below into your browser:</p>
                <div style="background-color: #eff6ff; padding: 12px; border-radius: 4px; word-break: break-all;">
                    <a href="{{ $loginUrl }}" style="color: #2563eb; text-decoration: none; font-size: 13px;">{{ $loginUrl }}</a>
                </div>
            </div>

            <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>

            <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; font-size: 14px; color: #333;">
                <strong>SCLF Desk</strong><br>
                <span>Opol Community College </span><br>
                {{ $rolePill("Admin") }}
            </div>
        </div>

        <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 5px 0;"><strong>Student Campus Lost &amp; Found &middot; Opol Community College</strong></p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0;">&copy; 2026 Opol Community College. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
