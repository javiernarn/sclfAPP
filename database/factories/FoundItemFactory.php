<?php

namespace Database\Factories;

use App\Models\FoundItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FoundItemFactory extends Factory
{
    protected $model = FoundItem::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'item_name' => $this->faker->words(2, true),
            'description' => $this->faker->sentence(),
            'category' => $this->faker->randomElement(['Electronics', 'Wallets', 'Keys', 'ID Cards', 'Bags']),
            'brand' => $this->faker->company(),
            'color' => $this->faker->safeColorName(),
            'location_found' => $this->faker->randomElement(['Library', 'Cafeteria', 'Gymnasium', 'Main Building']),
            'date_found' => now()->toDateString(),
            'status' => FoundItem::STATUS_STORED,
            'verification_status' => 'approved',
        ];
    }
}
