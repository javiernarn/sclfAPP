import React from 'react';
import { Navigate } from 'react-router-dom';

// The report form now lives inside the Found Items page (Create button).
// This route stays so old links, bookmarks and notifications keep working.
export default function FoundItemCreate() {
    return <Navigate to="/app/found-items?new=1" replace />;
}
