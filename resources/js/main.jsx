

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RootApp from './RootApp';

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <RootApp />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);