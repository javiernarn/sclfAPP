

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import RootApp from './RootApp';
import { registerServiceWorker } from './utils/push';

// Registering here (rather than only when the user flips the settings
// toggle on) means the worker is already installed and ready by the time
// they do turn notifications on, so enablePush() in usePushNotifications
// doesn't have to wait on a fresh registration mid-click. Registering
// never itself prompts for permission — that only happens in enablePush().
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            {/* ToastProvider/ConfirmProvider sit above everything else so
                every page — including the public auth pages, which render
                before AuthProvider resolves a user — can raise a styled
                toast or a "discard changes?" dialog instead of a native
                alert()/confirm() popup. */}
            <ToastProvider>
                <ConfirmProvider>
                    <AuthProvider>
                        <RootApp />
                    </AuthProvider>
                </ConfirmProvider>
            </ToastProvider>
        </BrowserRouter>
    </React.StrictMode>
);