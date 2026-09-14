import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { InputDropdownManager } from './inputDropdownManager.js';
import { InputDataService } from '../services/inputDataService.js';
import { MODE_KEY } from '../config/modes.js';

// ============================================================================
// Константи модуля
// ============================================================================

const MIN_SEARCH_LENGTH = 1;

const INPUT_DEBOUNCE_DELAY_MS = 250;

const REFRESH_BASE_DELAY_MS = 5000;
const REFRESH_MAX_DELAY_MS = 30000;
const REFRESH_BACKOFF_MULTIPLIER = 1.5;

const KYIV_DSO_ID = '902';

// ============================================================================
// МЕНЕДЖЕР ІНПУТІВ
// Зберігає location-преференції та house-дані через CacheManager.
// Міста/вулиці більше не беруться з локального settlements.json — усі дані
// (список міст, вулиць, будинків) запитуються асинхронно через InputDataService,
// який звертається до background. Через це пошук і валідація полів тепер
// асинхронні: input/blur-хендлери очікують відповідь мережі.
// ============================================================================
export class InputManager {
    constructor(dom, cacheManager, onInputFinalSelect) {
        this.dom = dom;
        this.cache = cacheManager;
        this.onInputFinalSelect = onInputFinalSelect;

        this.inputsWrapper = null;
        this.refreshTimeout = null;
        this.retryAttempt = 0;
        this.isRefreshing = false;
        this.debounceTimer = null;

        this.inputMap = {
            city: 'cityInput',
            street: 'streetInput',
            house: 'houseInput'
        };

        this.dataService = null;
        this.inputs = null;
        this.renderedDsoId = null;

        this.dropdownManager = new InputDropdownManager(this.dom, this.inputMap);

        this.state = { city: null, street: null, house: null };
        this.searchTokens = { city: 0, street: 0, house: 0 };

        this.handleOutsideClick = this.handleOutsideClick.bind(this);
    }

    async init() {
        if (!this.dom.cityInput) return;
        await this.#initDataService();

        document.addEventListener('click', this.handleOutsideClick, true);

        this.inputs.forEach(input => this.setupInput(input));
        this.updateInputStates();
        this.startRefreshTimer();
    }

    getValues() {
        return {
            city: this.state.city,
            street: this.state.street,
            house: this.state.house
        };
    }

    closeAll() {
        this.dropdownManager.closeAll();
    }

    // ------------------------------------------------------------------
    // Ініціалізація dataService / конфігурації полів
    // ------------------------------------------------------------------

    // Створює dataService і конфіг інпутів (раніше тут ще й вантажився
    // data/settlements.json — тепер дані завантажуються лениво, per-запит,
    // всередині InputDataService).
    async #initDataService() {
        const modeKey = await Utils.getModeKey();
        const { dsoId, regionId } = this.cache.getSelect(modeKey);

        // Якщо режим і dsoId не змінились — dataService лишається той самий.
        if (this.dataService && this.dataService.mode === modeKey && this.dataService.dsoId === dsoId) {
            return;
        }

        this.cache.setActiveMode(modeKey);
        this.cache.setActiveDsoId(dsoId);

        this.dataService = new InputDataService(modeKey, dsoId, regionId, this.cache);

        this.inputs = [
            {
                type: 'city',
                key: 'cityInput',
                cacheKey: 'city',
                validator: async (value) => !value || !(await this.dataService.isValidCity(value)),
                onInvalid: () => this.clearCity()
            },
            {
                type: 'street',
                key: 'streetInput',
                cacheKey: 'street',
                validator: async (value) => !value || !(await this.dataService.isValidStreet(this.state.city, value)),
                onInvalid: () => this.clearStreet(),
                dependsOn: 'city'
            },
            {
                type: 'house',
                key: 'houseInput',
                cacheKey: 'house',
                validator: async () => false,
                onInvalid: () => this.clearHouse(),
                dependsOn: 'street'
            }
        ];
    }

    #getLabel(value) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return String(value.city ?? value.street ?? value.house ?? value.name ?? value.value ?? '');
    }

    // Формат houseData відрізняється між режимами: DTEK віддає sub_type_reason
    // (масив на кшталт ["GPV1.2"]), Yasno — окремі поля group/subgroup.
    #extractGroup(houseData) {
        if (this.dataService.mode === 'dtek') {
            return houseData.sub_type_reason[0].replace('GPV', '');
        }
        return `${houseData.group}.${houseData.subgroup}`;
    }

    // ------------------------------------------------------------------
    // Таймер періодичного оновлення house-даних
    // ------------------------------------------------------------------

    startRefreshTimer() {
        this.stopRefreshTimer();
        this.scheduleNextRefresh();
    }

    scheduleNextRefresh() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
        }

        const houseData = this.cache.getHouseData();
        const updateTimestamp = houseData?.updateTimestamp;

        let delay;

        if (!updateTimestamp) {
            const calculatedDelay = REFRESH_BASE_DELAY_MS * Math.pow(REFRESH_BACKOFF_MULTIPLIER, this.retryAttempt);
            delay = Math.min(calculatedDelay, REFRESH_MAX_DELAY_MS);

            this.retryAttempt++;
        } else {
            this.retryAttempt = 0;

            const elapsed = Date.now() - updateTimestamp;
            const remaining = CONSTANTS.CACHE_TTL.HOUSE_DATA - elapsed;
            delay = Math.max(0, remaining);
        }

        this.refreshTimeout = setTimeout(async () => {
            try {
                await this.checkAndRefreshData();
            } catch (error) {
                console.error('[scheduleNextRefresh] Refresh failed:', error);
            } finally {
                this.scheduleNextRefresh();
            }
        }, delay);
    }

    stopRefreshTimer() {
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
    }

    async checkAndRefreshData() {
        if (this.isRefreshing) {
            return;
        }

        if (!this.state.city || !this.state.street || !this.state.house) {
            return;
        }

        this.isRefreshing = true;
        try {
            const cached = this.cache.getHouseData();
            const updateTimestamp = cached?.updateTimestamp;

            const needsRefresh = !updateTimestamp ||
                (Date.now() - updateTimestamp >= CONSTANTS.CACHE_TTL.HOUSE_DATA);

            if (needsRefresh) {
                await this.refreshHouseData();

                const newData = this.cache.getHouseData();
                if (newData?.data) {
                    await this.showHouseData();
                }
            }
        } finally {
            this.isRefreshing = false;
        }
    }

    async refreshHouseData() {
        try {
            await this.dataService.loadHousesForStreet(
                this.state.city,
                this.state.street,
                this.state.house
            );

            const houseData = await this.dataService.getHouseData(this.state.house);

            if (!houseData) {
                return;
            }

            const timestamp = this.dataService.getUpdateTimestamp();
            this.cache.setHouseData(houseData, timestamp);
            await this.showHouseData();

        } catch (error) {
            console.error('[refreshHouseData] CRITICAL ERROR:', error);
            throw error;
        }
    }

    // ------------------------------------------------------------------
    // Обробники подій полів вводу
    // ------------------------------------------------------------------

    handleOutsideClick(e) {
        if (!this.inputsWrapper?.contains(e.target)) {
            this.dropdownManager.closeAll();
        }
    }

    setupInput({ type, key, validator, onInvalid, dependsOn }) {
        const input = this.dom[key];
        if (!input || input.dataset.initialized) return;
        input.dataset.initialized = 'true';

        input.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            clearTimeout(this.debounceTimer);

            if (dependsOn && !this.state[dependsOn]) {
                this.dropdownManager.remove(type);
                return;
            }

            const token = ++this.searchTokens[type];

            this.debounceTimer = setTimeout(async () => {
                if (this.state[type] !== null && await validator(value)) {
                    if (this.searchTokens[type] !== token) return;
                    this.state[type] = null;
                    onInvalid?.();
                    this.updateInputStates();
                }

                if (this.searchTokens[type] !== token) return;

                if (value.length < MIN_SEARCH_LENGTH) {
                    this.dropdownManager.remove(type);
                    return;
                }

                const matches = await this.dataService.search(type, value, this.state);
                if (this.searchTokens[type] !== token) return;

                if (!matches.length) {
                    this.dropdownManager.remove(type);
                    return;
                }

                this.dropdownManager.render(type, matches, (t, option) => {
                    this.selectOption(t, option);
                    this.dropdownManager.remove(t);
                });
            }, INPUT_DEBOUNCE_DELAY_MS);
        });

        if (type !== 'house') {
            input.addEventListener('blur', async () => {
                clearTimeout(this.debounceTimer);

                const value = input.value.trim();
                const token = ++this.searchTokens[type];

                if (await validator(value)) {
                    if (this.searchTokens[type] !== token) return;
                    input.value = '';
                    this.state[type] = null;
                    onInvalid?.();
                    this.updateInputStates();
                }
            });
        }
    }

    // ------------------------------------------------------------------
    // Робота зі значеннями полів
    // ------------------------------------------------------------------

    setInputValue(type, value) {
        const config = this.inputs.find(i => i.type === type);
        const input = this.dom[config.key];
        if (!input) return;

        input.value = this.#getLabel(value);
        this.state[type] = value || null;
    }

    async setAndSaveValue(type, value) {
        const config = this.inputs.find(i => i.type === type);
        if (!config) return;

        this.setInputValue(type, value);
        this.cache.setLocation({ [config.cacheKey]: value });
        this.updateInputStates();
    }

    async selectOption(type, option) {
        await this.setAndSaveValue(type, option);

        if (type === 'city') {
            this.clearStreet();
        }

        if (type === 'street') {
            this.clearHouse();
            await this.dataService.loadHousesForStreet(this.state.city, option);
        }

        if (type === 'house') {
            const houseData = await this.dataService.getHouseData(option);

            if (!houseData) {
                console.error('[selectOption] Не вдалося отримати дані по будинку');
                return;
            }

            const timestamp = this.dataService.getUpdateTimestamp();
            const group = this.#extractGroup(houseData);
            const { group: selectedGroup } = this.cache.getSelect();

            this.cache.setHouseData(houseData, timestamp);
            this.cache.setLocation({ group });

            if (group !== selectedGroup) await this.onInputFinalSelect(group);
            await this.showHouseData();
        }
    }

    // Завантажуємо збережені значення з in-memory кешу (без звернення до storage)
    async loadSavedValues() {
        const loc = this.cache.getLocation();

        if (this.dataService.dsoId !== KYIV_DSO_ID) {
            if (!loc.city || !(await this.dataService.isValidCity(loc.city))) return;
            this.setInputValue('city', loc.city);
        }

        if (!loc.street || (!(await this.dataService.isValidStreet(loc.city, loc.street)) && this.dataService.dsoId !== KYIV_DSO_ID)) return;
        this.setInputValue('street', loc.street);
        await this.dataService.loadHousesForStreet(loc.city, loc.street, loc.house ?? null);

        if (!loc.house) return;
        this.setInputValue('house', loc.house);

        const { group: selectGroup } = this.cache.getSelect();
        if (loc.group && loc.group !== selectGroup) {
            await this.onInputFinalSelect(loc.group);
        }

        await this.showHouseData();
        this.updateInputStates();
    }

    clearCity() {
        this.clearField('city');
        this.clearStreet();
    }

    clearStreet() {
        this.clearField('street');
        this.clearHouse();
    }

    clearHouse() {
        this.clearField('house');
        this.dataService.clearHouses();
    }

    clearField(type) {
        const config = this.inputs.find(i => i.type === type);
        this.state[type] = null;
        const input = this.dom[config.key];
        if (input) input.value = '';
        this.cache.setLocation({ [config.cacheKey]: '' });
    }

    updateInputStates() {
        const extended = this.inputsWrapper?.dataset.extended === 'true';
        const hasCity = this.state.city !== null;
        const hasStreet = this.state.street !== null;
        const isKyivLocked = String(this.dataService?.dsoId) === KYIV_DSO_ID;

        if (this.dom.cityInput) {
            this.dom.cityInput.disabled = isKyivLocked ? true : !extended;
        }
        if (this.dom.streetInput) {
            this.dom.streetInput.disabled = !extended || !hasCity;
            if (!hasCity) this.dom.streetInput.value = '';
        }
        if (this.dom.houseInput) {
            this.dom.houseInput.disabled = !extended || !hasStreet;
            if (!hasStreet) this.dom.houseInput.value = '';
        }
    }

    // ------------------------------------------------------------------
    // Рендер стану електропостачання
    // ------------------------------------------------------------------

    #buildOutageHtml(data, updateTimestamp) {
        const { sub_type, start_date, end_date } = data;
        return `
        <div class="outage-card glass-blur p-8 z-5 popup">
            <div class="outage-body">
            <p>Причина: <strong>${sub_type}</strong></p>
            <p>Початок: <strong>${Utils.formatFullDateTime(start_date)}</strong></p>
            <p>Відновлення: <strong>до ${Utils.formatFullDateTime(end_date)}</strong></p>
            <p>Оновлено: <strong>${Utils.formatFullDate(new Date(updateTimestamp))}</strong></p>
            </div>
        </div>
        `;
    }

    #buildNoOutageHtml(updateTimestamp) {
        return `
        <div class="outage-card glass-blur glass-panel p-8 z-5 popup info-mode">
            <div class="outage-body info-text">
            <p>Якщо зараз у вас відсутнє світло, імовірно виникла <strong>аварійна ситуація</strong>, або діють стабілізаційні чи екстрені відключення.</p>
            <p>Просимо перевірити інформацію через <strong>15 хвилин</strong> (час на оновлення даних).</p>
            <p>Оновлено: <strong>${Utils.formatFullDate(new Date(updateTimestamp))}</strong></p>
            </div>
        </div>
        `;
    }

    async showHouseData() {
        if (this.dataService.mode === 'yasno') return;

        const cached = this.cache.getHouseData();
        const data = cached?.data;
        const updateTimestamp = cached?.updateTimestamp;

        let container = this.dom.contentWrapper.querySelector('#content-header');

        if (!container) {
            container = document.createElement('div');
            container.id = 'content-header';
            container.classList.add('flex-col');
            this.dom.contentWrapper.insertBefore(container, this.dom.contentWrapper.firstChild);
        }

        if (!data) {
            container.innerHTML = `<button id="toggle-outage-btn" class="glass-panel flex-center g-10" title='Дані завантажуються'><div class="loader small"></div>Оновлення даних</button>`;
            return;
        }

        const hasOutage = data.sub_type?.trim() !== '';
        const outageHtml = hasOutage
            ? this.#buildOutageHtml(data, updateTimestamp)
            : this.#buildNoOutageHtml(updateTimestamp);

        container.innerHTML = `
        <button id="toggle-outage-btn" class="glass-panel flex-center g-10" title='Переглянути стан електропостачання'>${hasOutage ? "⚠️ За адресою відсутня електроенергія" : "Стан електропостачання"}</button>
        ${outageHtml}
        `;

        const button = container.querySelector('#toggle-outage-btn');
        const popup = container.querySelector('.outage-card');

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.classList.toggle('active');
        });

        document.addEventListener('click', () => popup.classList.remove('active'));
        popup.addEventListener('click', (e) => e.stopPropagation());
    }

    // ------------------------------------------------------------------
    // Побудова/знищення DOM полів вводу
    // ------------------------------------------------------------------

    #buildClearButtonHtml(action) {
        return `<button class="btn app-btn glass-panel flex-center small input-clear" data-action="${action}" title="Очистити"><div class="icon ic_cross"></div></button>`;
    }

    #bindClearButton(root, action, handler) {
        const btn = root.querySelector(`[data-action="${action}"]`);
        if (btn) {
            btn.addEventListener('click', handler);
        }
    }

    async renderInputs() {
        await this.#initDataService();
        const dsoId = this.dataService.dsoId;

        if (this.inputsWrapper) {
            this.removeInputs();
        }

        this.renderedDsoId = dsoId;

        const { extended } = await Utils.getStorageData(['extended']);
        const isExtended = extended === true;
        const disabled = isExtended ? '' : 'disabled';

        const isKyivLocked = String(dsoId) === KYIV_DSO_ID;
        const cityDisabled = isKyivLocked ? 'disabled' : disabled;
        const cityValue = isKyivLocked ? 'м. Київ' : '';
        const cityButtonHtml = isKyivLocked
            ? ''
            : this.#buildClearButtonHtml('clearCity');

        const titleVal = ['Розгорнути', 'Згорнути'];

        const root = document.createElement('div');
        root.className = 'location-root flex-col';
        root.dataset.extended = String(extended ?? false);
        root.innerHTML = `
        <div class="input-wrapper g-8">
            <div class="custom-input glass-panel">
                <input id="city" class="city-input" value="${cityValue}" ${cityDisabled} placeholder=" " />
                <label for="city" class="input-label">Населений пункт</label>
                ${cityButtonHtml}
            </div>
            <div class="custom-input glass-panel">
                <input id="street" class="street-input" ${disabled} placeholder=" " />
                <label for="street" class="input-label">Вулиця</label>
                ${this.#buildClearButtonHtml('clearStreet')}
            </div>
            <div class="custom-input glass-panel">
                <input id="house" class="house-number-input" ${disabled} placeholder=" " />
                <label for="house" class="input-label">Номер будинку</label>
                ${this.#buildClearButtonHtml('clearHouse')}
            </div>
        </div>
        <button class="location-btn flex-center" title="${isExtended ? titleVal[1] : titleVal[0]}">
            <div class="arrow-icon _8px ${isExtended ? 'up' : 'down'}"></div>
        </button>
    `;

        this.dom.controls.appendChild(root);
        this.inputsWrapper = root;

        this.dom.cityInput = root.querySelector('#city');
        this.dom.streetInput = root.querySelector('#street');
        this.dom.houseInput = root.querySelector('#house');
        this.dom.locationBtn = root.querySelector('.location-btn');

        if (isKyivLocked) {
            this.state.city = 'м. Київ';
        }

        this.updateInputStates();

        this.dom.locationBtn.addEventListener('click', async () => {
            const newExtended = root.dataset.extended !== 'true';

            root.dataset.extended = String(newExtended);
            await Utils.setStorageData({ extended: newExtended });

            const arrowIcon = this.dom.locationBtn.querySelector('.arrow-icon');
            arrowIcon?.classList.toggle('down', !newExtended);
            arrowIcon?.classList.toggle('up', newExtended);

            this.dom.locationBtn.title = newExtended ? titleVal[1] : titleVal[0];

            this.updateInputStates();
        });

        this.#bindClearButton(root, 'clearCity', () => this.clearCity());
        this.#bindClearButton(root, 'clearStreet', () => this.clearStreet());
        this.#bindClearButton(root, 'clearHouse', () => this.clearHouse());

        await this.loadSavedValues();
        await this.init();
    }

    removeInputs() {
        if (!this.inputsWrapper) return;
        this.stopRefreshTimer();

        this.inputsWrapper.remove();
        this.inputsWrapper = null;
        this.renderedDsoId = null;

        this.dom.cityInput = null;
        this.dom.streetInput = null;
        this.dom.houseInput = null;

        this.state.city = null;
        this.state.street = null;
        this.state.house = null;

        this.dom.contentWrapper.querySelector('#content-header')?.remove();
    }
}