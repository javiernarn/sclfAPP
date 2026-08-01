<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            {{ $lostItem->item_name }}
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-2xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white p-6 shadow sm:rounded-lg">

                @if ($lostItem->image_path)
                    <img src="{{ Storage::url($lostItem->image_path) }}" class="mb-4 rounded-md max-h-64">
                @endif

                <p class="mb-2"><span class="font-medium">Description:</span> {{ $lostItem->description }}</p>
                <p class="mb-2"><span class="font-medium">Category:</span> {{ $lostItem->category ?? '—' }}</p>
                <p class="mb-2"><span class="font-medium">Location Lost:</span> {{ $lostItem->location_lost ?? '—' }}</p>
                <p class="mb-2"><span class="font-medium">Date Lost:</span> {{ $lostItem->date_lost ?? '—' }}</p>
                <p class="mb-2"><span class="font-medium">Reported By:</span> {{ $lostItem->user->name }}</p>
                <p class="mb-2"><span class="font-medium">Status:</span> {{ ucfirst($lostItem->status) }}</p>

                <a href="{{ route('lost-items.index') }}" class="inline-block mt-4 text-indigo-600 hover:underline">
                    ← Back to Lost Items
                </a>
            </div>
        </div>
    </div>
</x-app-layout>