import React from 'react';
import { Navigate } from 'react-router-dom';

// The report form now lives inside the Lost Items page (Create button).
// This route stays so old links, bookmarks and notifications keep working.
export default function LostItemCreate() {
    return <Navigate to="/app/lost-items?new=1" replace />;
}
