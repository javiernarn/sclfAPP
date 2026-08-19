<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Every branch here is scoped to $request->user() — the currently
     * authenticated account — via Laravel's Notifiable trait on the User
     * model. That's what makes this role-agnostic: a student, instructor,
     * security officer, or admin all hit the exact same endpoint and each
     * only ever sees their own notifications (SclfNotification is sent to
     * a specific User instance wherever it's dispatched across the app).
     * There is deliberately no per-role branching here — the header bell
     * and the sidebar's Notifications page both work the same way for
     * every role for free.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // The header bell's dropdown just wants a handful of the most
        // recent notifications (read + unread) to preview — not a full
        // paginated page. Passing ?limit=8 switches 'notifications' from
        // Laravel's paginated shape ({ data, current_page, ... }) to a
        // plain array, so the bell can render it without pulling in
        // pagination UI it doesn't have room for. The full /app/notifications
        // page never sends this param, so its ->paginate(15) call below is
        // untouched.
        $limit = $request->integer('limit');

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
            'notifications' => $limit
                ? $user->notifications()->latest()->take(min($limit, 50))->get()
                : $user->notifications()->latest()->paginate(15),
        ]);
    }

    /**
     * Cheap, single-purpose endpoint the header bell polls on an interval
     * (and on window focus) to keep its badge number current without
     * re-fetching or re-rendering the notification list itself every time.
     */
    public function unreadCount(Request $request)
    {
        return response()->json([
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['success' => true]);
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        return response()->json(['success' => true]);
    }
}
