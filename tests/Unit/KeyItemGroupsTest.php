<?php

namespace Tests\Unit;

use App\Services\Matching\MatchVocabulary;
use Tests\TestCase;

/**
 * Each kind of key is its own item type, so a house key is never "the same
 * item" as a motorcycle key — only the generic "Key" is a cousin of all.
 */
class KeyItemGroupsTest extends TestCase
{
    public function test_every_key_item_in_the_dropdown_resolves_to_its_own_group(): void
    {
        $this->assertSame('house key', MatchVocabulary::itemGroup('House key'));
        $this->assertSame('house key', MatchVocabulary::itemGroup('Boarding house / Dorm key'));
        $this->assertSame('locker key', MatchVocabulary::itemGroup('Locker key'));
        $this->assertSame('classroom key', MatchVocabulary::itemGroup('Classroom / Office key'));
        $this->assertSame('motorcycle key', MatchVocabulary::itemGroup('Motorcycle key'));
        $this->assertSame('motorcycle key', MatchVocabulary::itemGroup('Tricycle key'));
        $this->assertSame('car key', MatchVocabulary::itemGroup('Car key / Remote'));
        $this->assertSame('padlock', MatchVocabulary::itemGroup('Padlock with key'));
        $this->assertSame('key', MatchVocabulary::itemGroup('Bunch of keys'));
    }

    public function test_house_key_and_vehicle_keys_are_not_cousins(): void
    {
        $this->assertFalse(MatchVocabulary::groupsCousins('house key', 'motorcycle key'));
        $this->assertFalse(MatchVocabulary::groupsCousins('house key', 'car key'));
        $this->assertFalse(MatchVocabulary::groupsCousins('locker key', 'motorcycle key'));
    }

    public function test_generic_key_is_a_cousin_of_the_specific_ones(): void
    {
        $this->assertTrue(MatchVocabulary::groupsCousins('key', 'house key'));
        $this->assertTrue(MatchVocabulary::groupsCousins('motorcycle key', 'key'));
    }
}
