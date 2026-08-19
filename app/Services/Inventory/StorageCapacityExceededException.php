<?php

namespace App\Services\Inventory;

use App\Models\StorageLocation;
use RuntimeException;

/**
 * Thrown by InventoryService when assigning/moving an item would put a
 * capacity-limited StorageLocation over its limit. Controllers catch this
 * and return a 422 rather than letting it surface as a 500 — it's a
 * validation-shaped failure (the request is well-formed, the state just
 * doesn't allow it), not a server error.
 */
class StorageCapacityExceededException extends RuntimeException
{
    public function __construct(public readonly StorageLocation $location)
    {
        parent::__construct(
            "Storage location {$location->code} is at capacity ({$location->currentItemCount()}/{$location->capacity})."
        );
    }
}
