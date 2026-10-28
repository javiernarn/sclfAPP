<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Formal profile-photo checks (server side)
    |--------------------------------------------------------------------------
    |
    | The browser already checks the face, centring, pose, lighting, blur, background,
    | cap/forehead and held objects
    | before a photo can be chosen (resources/js/utils/photoCheck.js). These
    | server checks repeat the ones that need no face detection, so the rules
    | can't be skipped by calling the API directly: minimum size, a plain light
    | background, sharpness, and AI-generation markers written into the file.
    |
    | They are deliberately more lenient than the browser's, so a photo the
    | browser accepted is never rejected here by a small measuring difference.
    |
    | Set PHOTO_CHECK_ENFORCE=false to switch them off (the test suite does,
    | because its fake uploads are tiny solid-colour images).
    |
    */

    'enforce' => (bool) env('PHOTO_CHECK_ENFORCE', true),

    'min_side' => 300,          // px, shorter side
    'min_sharpness' => 40.0,    // Laplacian variance of the centre at 192px
    'bg_min_fraction' => 0.6,   // share of edge pixels that look plain + light
    'max_pixels' => 25000000,   // skip pixel analysis above this (memory guard)

];
