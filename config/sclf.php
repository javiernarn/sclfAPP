<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Unclaimed item retention period
    |--------------------------------------------------------------------------
    |
    | Days a found item is held in storage before it becomes eligible to be
    | flagged unclaimed (see DispositionService). Set on the item at the
    | moment it's assigned storage — InventoryService::assignStorage() only
    | fills it in when the item doesn't already have one, so an officer can
    | still override it per item (e.g. a laptop held longer than a water
    | bottle) without this default fighting them.
    |
    */
    'retention_days' => env('SCLF_RETENTION_DAYS', 90),

];
