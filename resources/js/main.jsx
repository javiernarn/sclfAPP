

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import RootApp from './RootApp';

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