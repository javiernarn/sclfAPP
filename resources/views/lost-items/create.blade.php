<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 leading-tight">
            Report a Lost Item
        </h2>
    </x-slot>

    <div class="py-12">
        <div class="max-w-2xl mx-auto sm:px-6 lg:px-8">
            <div class="bg-white p-6 shadow sm:rounded-lg">

                @if ($errors->any())
                    <div class="mb-4 text-red-600">
                        <ul>
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <form method="POST" action="{{ route('lost-items.store') }}" enctype="multipart/form-data">
                    @csrf

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Item Name</label>
                        <input type="text" name="item_name" value="{{ old('item_name') }}"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Description</label>
                        <textarea name="description" rows="4"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">{{ old('description') }}</textarea>
                    </div>

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Category</label>
                        <input type="text" name="category" value="{{ old('category') }}"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                            placeholder="e.g. Electronics, ID Card, Bag">
                    </div>

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Location Lost</label>
                        <input type="text" name="location_lost" value="{{ old('location_lost') }}"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Date Lost</label>
                        <input type="date" name="date_lost" value="{{ old('date_lost') }}"
                            class="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    </div>

                    <div class="mb-4">
                        <label class="block font-medium text-sm text-gray-700">Photo (optional)</label>
                        <input type="file" name="image" class="mt-1 block w-full">
                    </div>

                    <button type="submit"
                        class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                        Submit Report
                    </button>
                </form>

            </div>
        </div>
    </div>
</x-app-layout>