import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';
import { BASE_URL } from './constant';

const instance = axios.create({
    baseURL: BASE_URL + 'api/',
    timeout: 15000,
});

instance.interceptors.response.use(
    (response) => response,
    (error) => {
        const statusCode = error.response?.status || null;

        if (error.config?.silent) {
            return Promise.reject(error);
        }

        if (statusCode === 401 && !error.config?.skipAuthRedirect) {
            secureLocalStorage.removeItem('access_token');
            window.location.href = `/login?type=session-expired`;
            return Promise.reject(error);
        }

        if (statusCode === 422) {
            const validationMessage = error.response?.data?.errors
                ? Object.values(error.response.data.errors).flat().join('\n')
                : 'Validation error.';
            alert(validationMessage);
            return Promise.reject(error);
        }

        const errorMessage =
            error.code === 'ECONNABORTED'
                ? 'The request timed out. Please try again.'
                : !error.response
                ? 'Could not reach the server. Please check your connection.'
                : error.response?.data?.message || 'An unexpected error occurred.';

        alert(errorMessage);
        return Promise.reject(error);
    }
);

const updateAuthToken = () => {
    const token = secureLocalStorage.getItem('access_token');
    if (token) {
        instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
};

updateAuthToken();

export const refreshAuthToken = (newToken) => {
    secureLocalStorage.setItem('access_token', newToken);
    updateAuthToken();
};

export default instance;