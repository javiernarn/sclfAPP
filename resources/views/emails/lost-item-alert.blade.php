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
    <title>Lost item: {{ $item['item_name'] }} - SCLF</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
    <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">

        {{-- Header: same format as notification.blade.php --}}
        <div style="text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px;">
            <img src="{{ $message->embed(resource_path('js/assets/images/site-logo.png')) }}" alt="SCLF Logo" style="max-width: 120px; height: auto; margin-bottom: 15px;">
            <div style="display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #2563eb; border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 12px;">Lost Item Alert</div>
            <h1 style="color: #0f2a5c; margin: 0; font-size: 24px;">{{ $item['item_name'] }}</h1>
            <p style="color: #666; margin: 5px 0 0;">Student Campus Lost &amp; Found &middot; Opol Community College</p>
        </div>

        <div style="margin-bottom: 30px;">
            <h2 style="color: #0f2a5c; font-size: 20px; margin-bottom: 15px;">Hello{{ $fullName ? ' '.$fullName : '' }},</h2>

            <div style="background-color: #eff6ff; border: 1px solid #2563eb; padding: 15px; margin: 0 0 25px; border-radius: 12px;">
                <p style="margin: 0; font-size: 15px;">
                    <strong>{{ $item['owner_label'] }}</strong> lost an item
                    @if(!empty($item['location_lost'])) near <strong>{{ $item['location_lost'] }}</strong>@endif
                    @if(!empty($item['date_lost'])) on <strong>{{ $item['date_lost'] }}</strong>@endif.
                    If you have seen or found it, please help it get back to its owner.
                </p>
            </div>

            @if(!empty($item['image_url']))
                <div style="text-align: center; margin: 0 0 25px;">
                    <img src="{{ $item['image_url'] }}" alt="{{ $item['item_name'] }}" style="max-width: 100%; max-height: 280px; border-radius: 10px; border: 1px solid #dbeafe;">
                </div>
            @endif

            {{-- Item details --}}
            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Item details</h3>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; font-size: 14px;">
                    @foreach([
                        'Item' => $item['item_name'],
                        'Category' => $item['category'],
                        'Brand' => $item['brand'],
                        'Model' => $item['model'],
                        'Color' => $item['color'],
                        'Distinguishing marks' => $item['unique_characteristics'],
                        'Last seen' => $item['location_lost'],
                        'Date lost' => trim(($item['date_lost'] ?? '') . ' ' . ($item['time_lost'] ?? '')),
                        'Campus' => $item['campus'],
                        'Description' => $item['description'],
                    ] as $label => $value)
                        @if(!empty($value))
                            <tr>
                                <td style="padding: 6px 12px 6px 0; color: #666; vertical-align: top; width: 38%;">{{ $label }}</td>
                                <td style="padding: 6px 0; color: #0f2a5c; font-weight: 600; vertical-align: top;">{{ $value }}</td>
                            </tr>
                        @endif
                    @endforeach
                </table>
            </div>

            {{-- Approval details from admin / security / staff --}}
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px; padding: 15px; margin: 20px 0; font-size: 14px;">
                <strong style="color: #0f2a5c;">Verified &amp; approved by</strong><br>
                {{ $item['approver_name'] }} &middot; {{ $rolePill($item['approver_role']) }}<br>
                <span style="color: #666;">{{ $item['approved_at'] }}</span>
                @if(!empty($item['approval_note']))
                    <p style="margin: 10px 0 0; color: #333;"><strong>Note from the desk:</strong> {{ $item['approval_note'] }}</p>
                @endif
            </div>

            {{-- Primary button: found it --}}
            <div style="text-align: center; margin: 30px 0 12px;">
                <a href="{{ $foundUrl }}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">I Found This Item &ndash; Report It</a>
            </div>
            <div style="text-align: center; margin: 0 0 30px;">
                <a href="{{ $viewUrl }}" style="color: #2563eb; font-size: 14px; text-decoration: underline;">Login to SCLF</a>
            </div>

            <div style="background-color: #f5f9ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #0f2a5c; font-size: 16px; margin: 0 0 15px; border-bottom: 1px solid #dee2e6; padding-bottom: 10px;">Button not working?</h3>
                <p style="font-size: 13px; margin-bottom: 10px;">Copy and paste the link below into your browser:</p>
                <div style="background-color: #eff6ff; padding: 12px; border-radius: 4px; word-break: break-all;">
                    <a href="{{ $foundUrl }}" style="color: #2563eb; text-decoration: none; font-size: 13px;">{{ $foundUrl }}</a>
                </div>
            </div>

            <p style="font-size: 13px; color: #666;">You're receiving this because you have an SCLF account. Please don't share the owner's details publicly &mdash; report the item through SCLF and the Lost &amp; Found desk will handle the return.</p>

            <div style="background-color: #eff6ff; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; font-size: 14px; color: #333;">
                <strong>SCLF Desk</strong><br>
                <span>Opol Community College </span><br>
                {{ $rolePill("Admin") }}
            </div>
        </div>

        <div style="text-align: center; border-top: 1px solid #dee2e6; padding-top: 20px; color: #666; font-size: 14px;">
            <p style="margin: 5px 0;"><strong>Student Campus Lost &amp; Found &middot; Opol Community College</strong></p>
            <p style="margin: 5px 0;">This is an automated message. Please do not reply directly to this email.</p>
            <p style="margin: 5px 0;">&copy; {{ date('Y') }} Opol Community College. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
