import secureLocalStorage from 'react-secure-storage';

const getStorage = (key) => secureLocalStorage.getItem(key);

const delay = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const formatDate = (date, time = false) => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d)) return 'Invalid Date';
    return time ? d.toLocaleString() : d.toLocaleDateString();
};

export { getStorage, delay, formatDate };