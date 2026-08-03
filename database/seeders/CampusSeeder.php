<?php

namespace Database\Seeders;

use App\Models\Campus;
use Illuminate\Database\Seeder;

class CampusSeeder extends Seeder
{
    public function run(): void
    {
        Campus::firstOrCreate(['code' => 'MAIN'], ['name' => 'Main Campus']);
    }
}
