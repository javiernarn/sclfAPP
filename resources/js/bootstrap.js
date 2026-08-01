import axios from 'axios';
import secureLocalStorage from 'react-secure-storage';

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.baseURL = 'http://127.0.0.1:8000';

// Attach the saved token (if any) to every request automatically
const token = secureLocalStorage.getItem('sclf_token');
if (token) {
    window.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default axios;