// utils.js
import { MODE_KEY } from '../config/modes.js';
const months = Object.freeze(["січ", "лют", "бер", "квіт", "трав", "чер", "лип", "серп", "вер", "жовт", "лист", "груд"]);
const INVALID_VALUES = new Set([undefined, null, '', 'none']);

/**
 * Утилітарний клас для роботи з Chrome API та загальними функціями
 */
class Utils {
    /**
     * Надсилає повідомлення через chrome.runtime.sendMessage
     * @param {Object} message - повідомлення для відправки
     * @returns {Promise<any>} - відповідь
     */
    static sendMessage(message) {
        return new Promise(resolve => {
            chrome.runtime.sendMessage(message, response => {
                if (chrome.runtime.lastError) {
                    console.warn('sendMessage:', chrome.runtime.lastError.message);
                    resolve(undefined);
                    return;
                }
                resolve(response);
            });
        });
    }

    /**
     * Форматує дату у вигляді "день місяць." наприклад "4 бер."
     * @param {Date} date - дата для форматування
     * @returns {string} - відформатована дата
     */
    static formatDate(date) {
        const d = new Date(date);
        return `${d.getDate()} ${months[d.getMonth()]}.`;
    }

    /**
     * Форматує рядок дати та часу у вигляді "HH:MM день місяць. рік р." наприклад "12:41 4 бер. 2026р."
     * @param {string} dateStr - рядок у форматі "HH:MM DD.MM.YYYY"
     * @returns {string} - відформатований рядок або "—" якщо дані відсутні
     */
    static formatFullDateTime(dateStr) {
        if (!dateStr) return '—';
        const [time, datePart] = dateStr.split(' ');

        const [day, month, year] = datePart.split('.');

        const monthIndex = parseInt(month, 10) - 1;
        const dayNumber = parseInt(day, 10);

        return `${time} ${dayNumber} ${months[monthIndex]}. ${year} р.`;
    }

    static formatDateOnly(date) {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${d.getDate()} ${months[d.getMonth()]}. ${d.getFullYear()} р.`;
    }

    /**
     * Форматує об'єкт Date у вигляді "HH:MM день місяць. рік р." наприклад "12:41 4 бер. 2026р."
     * @param {Date|string|number} date - дата для форматування
     * @returns {string} - відформатований рядок
     */
    static formatFullDate(date) {
        const d = new Date(date);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes} ${d.getDate()} ${months[d.getMonth()]}. ${d.getFullYear()} р.`;
    }

    static formatUpdatedOn(updatedOn) {
        const date = new Date(updatedOn);
        const now = new Date();

        const time = date.toLocaleTimeString('uk-UA', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const isSameDay = (a, b) =>
            a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();

        if (isSameDay(date, now)) {
            return `Оновлено ${time}`;
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);

        if (isSameDay(date, yesterday)) {
            return `Оновлено вчора о ${time}`;
        }

        const day = date.getDate();
        const month = months[date.getMonth()];

        return `Оновлено ${day} ${month} ${time}`;
    }

    /**
     * Парсить рядок дати у timestamp
     * @param {string} str - рядок у форматі "HH:MM DD.MM.YYYY"
     * @returns {number} - timestamp у мілісекундах
     */
    static parseToTimestamp(str) {
        const [time, date] = str.split(' ');

        const [hours, minutes] = time.split(':').map(Number);
        const [day, month, year] = date.split('.').map(Number);

        const d = new Date(year, month - 1, day, hours, minutes);

        return d.getTime();
    }

    /* ---------- утиліти часу ---------- */
    static minutesToTime(min) {
        if (min === 1440) return '00:00';
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // Конвертує хвилини доби (0-1439) + unix-timestamp дня (сек) у Date
    static minutesToDate(baseTimestampSec, minutes) {
        return new Date((baseTimestampSec + minutes * 60) * 1000);
    }

    /**
     * Отримує дані з chrome.storage.local
     * @param {string|string[]} keys - ключ або масив ключів
     * @returns {Promise<Object>} - об'єкт з даними
     */
    static getStorageData(keys) {
        return chrome.storage.local.get(keys);
    }

    /**
     * Отримує значення за конкретним ключем
     * @param {string} key - ключ
     * @returns {Promise<any>} - значення
     */
    static async getStorageValue(key) {
        const result = await chrome.storage.local.get(key);
        return result[key];
    }

    /**
     * Зберігає дані у chrome.storage.local
     * @param {Object} data - об'єкт з даними для збереження
     * @returns {Promise<void>}
     */
    static setStorageData(data) {
        return chrome.storage.local.set(data);
    }

    /**
     * Видаляє дані з chrome.storage.local
     * @param {string|string[]} key - ключ або масив ключів
     * @returns {Promise<void>}
     */
    static removeStorageData(key) {
        return chrome.storage.local.remove(key);
    }

    /**
     * Створює затримку на вказаний час
     * @param {number} ms - мілісекунди
     * @returns {Promise<void>}
     */
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static shortenId(id, startLen = 5, endLen = 5) {
        if (!id || id.length <= startLen + endLen) return id;
        return `${id.slice(0, startLen)}...${id.slice(-endLen)}`;
    }

    static DSOID_TO_DTEK_TYPE = {
        'none': 'none', //Не обрано
        301: 'dnem',    // ДНЕМ
        303: 'сek',     // ЦЕК
        902: 'kem',     // КЕМ
    };

    static setErrorTextarea(el) {
        el.closest('.custom-textarea')?.classList.add('input-error');
    }

    static clearErrorTextarea(el) {
        el.closest('.custom-textarea')?.classList.remove('input-error');
    }

    /**
     * Генерує HTML для відображення помилки завантаження
     * @returns {string} - HTML рядок
     */
    static buildLoadErrorHTML(error = {}) {
        return `
        <p class="message p-8">Не вдалося завантажити дані 😢</p>

        ${error?.message
                ? `<p class="message p-8 secondary-text">Причина: ${error.message}</p>`
                : ''}

        ${error?.url
                ? `<a href="${error.url}" target="_blank" rel="noopener noreferrer" class="message p-8 secondary-text">Відкрити сайт</a>`
                : ''}

        <br>

        <p class="message p-8 secondary-text">Перевірте з'єднання або перезапустіть розширення.</p>
        <p class="message p-8 secondary-text">Якщо помилка не зникає - спробуйте <b>очистити кеш</b> у розділі «Про розширення».</p>
    `;
    }

    static buildStatusIndicatorHTML(type) {
        const titles = {
            ok: 'Відключення',
            warning: '⏳',
            danger: '🚨',
            info: '⏳',
            choose: '👆'
        }
        const statuses = {
            ok: 'Не застосовуються',
            warning: 'Очікуємо на більш актуальні дані',
            danger: 'Екстрені відключення, графіки не діють',
            info: 'Очікуємо оновлення',
            choose: 'Оберіть ОСР, щоб перейти до вибору черги'
        };

        return `
        <div class="status-indicator flex-center flex-col">
            <div class="status-title ${type}">${titles[type] ?? ''}</div>
            <div class="status-badge ${type}">
                ${statuses[type] ?? ''}
            </div>
        </div>
    `;
    }


    /**
   * Повертає розмір даних у chrome.storage.local.
   * @param {string|string[]|null} keys null - усі ключі
   * @returns {Promise<{bytes:number, formatted:string}>}
   */
    static async getStorageSize(keys = null) {
        const bytes = await chrome.storage.local.getBytesInUse(keys);

        return {
            bytes,
            formatted: this.formatBytes(bytes)
        };
    }

    /**
    * Форматує байти у найближчу одиницю.
    * @param {number} bytes
    * @param {number} decimals
    * @returns {string}
    */
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Б';

        const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
        const index = Math.min(
            Math.floor(Math.log(bytes) / Math.log(1024)),
            units.length - 1
        );

        const value = bytes / Math.pow(1024, index);

        return `${value.toFixed(index === 0 ? 0 : decimals)} ${units[index]}`;
    }

    static toIso(str) {
        if (typeof str !== 'string' || !str.trim()) {
            return null;
        }

        const match = str.trim().match(
            /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/
        );

        if (!match) {
            return null;
        }

        const [, day, month, year, hours, minutes] = match;

        const date = new Date(
            Date.UTC(
                Number(year),
                Number(month) - 1,
                Number(day),
                Number(hours),
                Number(minutes)
            )
        );

        if (
            date.getUTCFullYear() !== Number(year) ||
            date.getUTCMonth() !== Number(month) - 1 ||
            date.getUTCDate() !== Number(day) ||
            date.getUTCHours() !== Number(hours) ||
            date.getUTCMinutes() !== Number(minutes)
        ) {
            return null;
        }

        return `${year}-${month}-${day}T${hours}:${minutes}:00+00:00`;
    }

    static semverCompare(a, b) {
        const clean = v => v.replace(/^[^0-9]*/, '').split('.').map(Number);
        const [va, vb] = [clean(a), clean(b)];
        for (let i = 0; i < 3; i++) {
            if (va[i] > vb[i]) return 1;
            if (va[i] < vb[i]) return -1;
        }
        return 0;
    }

    static async getInstallDate() {
        const { installDate } = await chrome.storage.sync.get('installDate');
        return installDate ? installDate : undefined;
    }

    static async copyStaticText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error("Error: ", err);
            return false;
        }
    }

    static async getMode() {
        const { mode } = await this.getStorageData(['mode']);
        return { mode }
    }

    static async getModeKey() {
        const { mode } = await this.getMode();
        return MODE_KEY[mode ?? 0];
    }

    static isInvalidValue = (...values) => values.some(value => INVALID_VALUES.has(value));
}

// Експорт для використання як модуль
export { Utils };

// Також експортуємо за замовчуванням для зручності
export default Utils;