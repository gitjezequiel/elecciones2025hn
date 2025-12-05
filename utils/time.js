/**
 * Gets the current time in Honduras (UTC-6) and formats it for MySQL.
 * @returns {string} Formatted timestamp string (e.g., '2023-10-27 10:30:00').
 */
const getHondurasTime = () => {
    // Create a date object representing the current UTC time
    const now = new Date();

    // Create a new date object for Honduras time by subtracting 6 hours (3600000 ms * 6)
    const hondurasTime = new Date(now.getTime() - (6 * 60 * 60 * 1000));

    const year = hondurasTime.getUTCFullYear();
    const month = String(hondurasTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(hondurasTime.getUTCDate()).padStart(2, '0');
    const hours = String(hondurasTime.getUTCHours()).padStart(2, '0');
    const minutes = String(hondurasTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(hondurasTime.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

module.exports = {
    getHondurasTime,
};
