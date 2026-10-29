import './utils/devtoolsGuard'; // hide the UI while DevTools is open (runs before React mounts)


import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import RootApp from './RootApp';
import { registerServiceWorker } from './utils/push';
import './utils/disableZoom'; // no pinch / double-tap zoom on phones and tablets
import './utils/pwaInstall'; // start listening for the browser's install event before React mounts
import InstallPrompt from './Components/shared/InstallPrompt';
import OfflineNotice from './Components/shared/OfflineNotice';
import { applySeason } from './seasons/season';
applySeason(); // FIRST/SECOND theme (see .env APP_SEASON) before first paint
import './i18n'; // applies the saved language to <html lang> before first paint
import { preloadImage } from './utils/imageCache';
import siteLogo from './assets/images/site-logo.png';

// The logo shows on every screen (sidebar, header, login). Start it loading
// before React mounts so it is never seen popping in.
preloadImage(siteLogo);

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
                        {/* Needs AuthProvider above it — it only polls
                            /notifications while a user session exists. */}
                        <PreferencesProvider>
                            <NotificationProvider>
                                <OfflineNotice />
                                <RootApp />
                                <InstallPrompt />
                            </NotificationProvider>
                        </PreferencesProvider>
                    </AuthProvider>
                </ConfirmProvider>
            </ToastProvider>
        </BrowserRouter>
    </React.StrictMode>
);