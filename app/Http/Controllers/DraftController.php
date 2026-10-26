<?php

namespace App\Http\Controllers;

use App\Models\FormDraft;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server side of Auto Save. One draft per account per form; every action is
 * scoped to the signed-in user, so nobody can read or touch another account's.
 */
class DraftController extends Controller
{
    /** The saved draft for a form, or { data: null } when there is none. */
    public function show(Request $request, string $form): JsonResponse
    {
        $this->assertKnownForm($form);

        $draft = $request->user()->formDrafts()->where('form_key', $form)->first();

        if ($draft && $draft->updated_at->lt(now()->subDays(FormDraft::MAX_AGE_DAYS))) {
            $draft->delete();
            $draft = null;
        }

        return response()->json($draft
            ? ['data' => $draft->data, 'saved_at' => $draft->client_saved_at]
            : ['data' => null, 'saved_at' => null]);
    }

    /** Create or replace the draft (last write wins). */
    public function store(Request $request, string $form): JsonResponse
    {
        $this->assertKnownForm($form);

        $validated = $request->validate([
            'data' => ['required', 'array'],
            'saved_at' => ['nullable', 'integer', 'min:0'],
        ]);

        if (strlen(json_encode($validated['data'])) > FormDraft::MAX_BYTES) {
            return response()->json(['message' => 'This draft is too large to save.'], 413);
        }

        $request->user()->formDrafts()->updateOrCreate(
            ['form_key' => $form],
            ['data' => $validated['data'], 'client_saved_at' => $validated['saved_at'] ?? (int) (microtime(true) * 1000)]
        );

        return response()->json(['success' => true]);
    }

    /** Forget one draft (after submitting, or pressing Cancel). */
    public function destroy(Request $request, string $form): JsonResponse
    {
        $this->assertKnownForm($form);

        $request->user()->formDrafts()->where('form_key', $form)->delete();

        return response()->json(['success' => true]);
    }

    /** Forget every draft of this account (Auto Save switched off). */
    public function destroyAll(Request $request): JsonResponse
    {
        $request->user()->formDrafts()->delete();

        return response()->json(['success' => true]);
    }

    private function assertKnownForm(string $form): void
    {
        abort_unless(in_array($form, FormDraft::FORM_KEYS, true), 404);
    }
}
