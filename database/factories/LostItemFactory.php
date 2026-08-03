<?php

namespace Database\Factories;

use App\Models\LostItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LostItemFactory extends Factory
{
    protected $model = LostItem::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'item_name' => $this->faker->words(2, true),
            'description' => $this->faker->sentence(),
            'category' => $this->faker->randomElement(['Electronics', 'Wallets', 'Keys', 'ID Cards', 'Bags']),
            'brand' => $this->faker->company(),
            'color' => $this->faker->safeColorName(),
            'location_lost' => $this->faker->randomElement(['Library', 'Cafeteria', 'Gymnasium', 'Main Building']),
            'date_lost' => now()->toDateString(),
            'status' => LostItem::STATUS_PENDING,
        ];
    }
}
