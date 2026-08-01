<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Lost Items
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-4xl mx-auto sm:px-6 lg:px-8">

            @if (session('success'))
                <div class="mb-4 p-4 bg-green-100 text-green-800 rounded-md">
                    {{ session('success') }}
                </div>
            @endif

            <div class="mb-4">
                <a href="{{ route('lost-items.create') }}"
                    class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                    + Report Lost Item
                </a>
            </div>

            <div class="bg-white shadow sm:rounded-lg divide-y">
                @forelse ($lostItems as $item)
                    <a href="{{ route('lost-items.show', $item) }}"
                        class="block p-4 hover:bg-gray-50">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="font-medium text-gray-900">{{ $item->item_name }}</p>
                                <p class="text-sm text-gray-500">{{ $item->category ?? 'Uncategorized' }} · Reported by {{ $item->user->name }}</p>
                            </div>
                            <span class="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                                {{ ucfirst($item->status) }}
                            </span>
                        </div>
                    </a>
                @empty
                    <p class="p-4 text-gray-500">No lost items reported yet.</p>
                @endforelse
            </div>

            <div class="mt-4">
                {{ $lostItems->links() }}
            </div>

        </div>
    </div>
</x-app-layout>