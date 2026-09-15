import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { MODE_KEY } from '../config/modes.js';

// ============================================================================
// МЕНЕДЖЕР СЕЛЕКТІВ
// Читає/пише значення через CacheManager (один об'єкт в пам'яті)
// ============================================================================

const QUEUE_PATTERNS = {
    3: { groups: 6, subs: 2 },
    25: { groups: 60, subs: 1 }
};

const DSOID_OPTIONS = {
    yasno: [
        { region: 'none', value: 'none', label: 'Не обрано' },
        { region: 3, value: 301, label: 'ДнЕМ' },
        { region: 3, value: 303, label: 'ЦЕК' },
        { region: 25, value: 902, label: 'КЕМ' }
    ],
    dtek: [
        { region: 'none', value: 'none', label: 'Не обрано' },
        { region: 3, value: 301, label: 'ДнЕМ' },
        { region: 25, value: 902, label: 'КЕМ' }
    ]
};

export class SelectManager {
    #currentRegion = null;
    #currentMode = null;

    constructor(dom, cacheManager, onSelectionChange) {
        this.dom = dom;
        this.cache = cacheManager;
        this.onSelectionChange = onSelectionChange;

        this.selects = [
            { element: dom.queueSelect, cacheKey: 'group', type: 'queue', defaultValue: CONSTANTS.DEFAULT_QUEUE },
            { element: dom.dsoSelect, cacheKey: 'dsoId', type: 'dsoId', defaultValue: CONSTANTS.DEFAULT_DSO_ID }
        ];

        this.handleOutsideClick = this.handleOutsideClick.bind(this);
    }

    async init() {
        if (!this.dom.queueSelect || !this.dom.dsoSelect) return;

        document.addEventListener('click', this.handleOutsideClick, true);
        this.selects.forEach(select => this.#setupSelect(select));
        this.#currentMode = await Utils.getModeKey();
        this.#regenerateDsoOptions(this.#currentMode, false);

        this.loadSavedValues();
    }

    async setMode(mode) {
        if (!(mode in MODE_KEY)) {
            console.error('[setMode] Невідомий режим:', mode);
            return;
        }

        const modeKey = MODE_KEY[mode] ?? 'yasno';
        if (modeKey === this.#currentMode) return;

        this.#currentMode = modeKey;
        this.#currentRegion = null;

        this.#regenerateDsoOptions(modeKey, false);
        this.loadSavedValues();
    }

    handleOutsideClick(e) {
        const clickedInsideSelect = this.selects.some(({ element }) =>
            element && element.contains(e.target)
        );
        if (!clickedInsideSelect) this.#closeAll();
    }

    #closeAll() {
        this.selects.forEach(({ element }) => element?.classList.remove('open'));
    }

    #setupSelect({ element, cacheKey, defaultValue, type }) {
        if (!element) return;

        element.addEventListener('click', (e) => {
            const option = e.target.closest('.option');

            if (option) {
                this.setSelectValue(element, type, option.dataset.value, defaultValue);

                const patch = { [cacheKey]: option.dataset.value };
                if (type === 'dsoId') patch.regionId = option.dataset.region;
                this.cache.setSelect(this.#currentMode, patch);

                if (type === 'dsoId') {
                    this.#handleRegionChange(option.dataset.region);
                }

                this.onSelectionChange?.(type);
                element.classList.remove('open');
            } else {
                e.stopPropagation();
                this.selects.forEach(({ element: other }) => {
                    if (other !== element) other?.classList.remove('open');
                });
                element.classList.toggle('open');
            }
        });
    }

    // ---- ОСР (dsoId) ---------------------------------------------------

    #buildDsoOptionsFragment(options) {
        const fragment = document.createDocumentFragment();

        for (const { region, value, label } of options) {
            const opt = document.createElement('div');
            opt.className = 'option';
            opt.dataset.region = String(region);
            opt.dataset.value = String(value);
            opt.textContent = label;
            fragment.appendChild(opt);
        }

        return fragment;
    }

    #regenerateDsoOptions(modeKey, resetValue = true) {
        const dsoSelect = this.dom.dsoSelect;
        const optionsContainer = dsoSelect?.querySelector('.select-options');
        if (!optionsContainer) return;

        const options = DSOID_OPTIONS[modeKey] ?? [];
        optionsContainer.replaceChildren(this.#buildDsoOptionsFragment(options));

        if (!resetValue) return;

        this.setSelectValue(dsoSelect, 'dsoId', CONSTANTS.DEFAULT_DSO_ID, CONSTANTS.DEFAULT_DSO_ID);
        this.cache.setSelect(modeKey, { dsoId: CONSTANTS.DEFAULT_DSO_ID, region: dsoSelect.dataset.region });

        this.#handleRegionChange(dsoSelect.dataset.region, resetValue);
    }


    #handleRegionChange(region, resetValue = true) {
        if (region === this.#currentRegion) return;
        this.#currentRegion = region;
        this.#regenerateQueueOptions(region, resetValue);
    }

    #generateQueueValues(region) {
        const pattern = QUEUE_PATTERNS[region];
        if (!pattern) return [];

        const values = [];
        for (let g = 1; g <= pattern.groups; g++) {
            for (let s = 1; s <= pattern.subs; s++) {
                values.push(`${g}.${s}`);
            }
        }
        return values;
    }

    #buildQueueOptionsFragment(region) {
        const fragment = document.createDocumentFragment();

        const allOption = document.createElement('div');
        allOption.className = 'option';
        allOption.dataset.value = CONSTANTS.DEFAULT_QUEUE;
        allOption.textContent = 'Усі';
        fragment.appendChild(allOption);

        for (const value of this.#generateQueueValues(region)) {
            const opt = document.createElement('div');
            opt.className = 'option';
            opt.dataset.value = value;
            opt.textContent = value;
            fragment.appendChild(opt);
        }

        return fragment;
    }

    #regenerateQueueOptions(region, resetValue = true) {
        const queueSelect = this.dom.queueSelect;
        const optionsContainer = queueSelect?.querySelector('.select-options');
        if (!optionsContainer) return;

        optionsContainer.replaceChildren(this.#buildQueueOptionsFragment(region));

        if (!resetValue) return;

        this.setSelectValue(queueSelect, 'queue', CONSTANTS.DEFAULT_QUEUE, CONSTANTS.DEFAULT_QUEUE);
        this.cache.setSelect(this.#currentMode, { group: CONSTANTS.DEFAULT_QUEUE });
    }

    setSelectValue(element, type, value, defaultValue) {
        if (!element) return;

        const selected = element.querySelector(`.option[selected]`);
        const option = element.querySelector(`.option[data-value="${value}"]`);
        if (!option) return;

        const trigger = element.querySelector('.select-trigger');
        element.dataset.value = value;
        if (type === 'dsoId') element.dataset.region = option.dataset.region;

        trigger.textContent = '';
        if (trigger && value !== defaultValue) trigger.textContent = option.textContent;

        element.classList.toggle('has-value', value !== defaultValue);

        if (selected) selected.removeAttribute('selected');
        option.setAttribute('selected', '');
    }

    async setAndSaveValue(type, value) {
        const select = this.selects.find(s => s.type === type);
        if (!select) return;

        this.setSelectValue(select.element, select.type, value, select.defaultValue);

        const patch = { [select.cacheKey]: value };
        if (type === 'dsoId') patch.regionId = select.element.dataset.region;
        this.cache.setSelect(this.#currentMode, patch);

        this.onSelectionChange?.(type);
    }

    loadSavedValues() {
        const saved = this.cache.getSelect(this.#currentMode);
        let dsoChanged = false;

        const dsoSelect = this.selects.find(s => s.type === 'dsoId');
        if (dsoSelect) {
            const savedDsoId = saved.dsoId;
            const option = savedDsoId && dsoSelect.element?.querySelector(`.option[data-value="${savedDsoId}"]`);
            const dsoIdValue = option ? savedDsoId : dsoSelect.defaultValue;

            this.setSelectValue(dsoSelect.element, dsoSelect.type, dsoIdValue, dsoSelect.defaultValue);

            this.#handleRegionChange(dsoSelect.element.dataset.region, false);
            dsoChanged = true;
        }

        const queueSelect = this.selects.find(s => s.type === 'queue');
        if (queueSelect) {
            const savedQueue = saved.group;
            const exists = savedQueue && queueSelect.element?.querySelector(`.option[data-value="${savedQueue}"]`);
            this.setSelectValue(queueSelect.element, queueSelect.type, exists ? savedQueue : queueSelect.defaultValue, queueSelect.defaultValue);
        }

        this.onSelectionChange?.(dsoChanged ? 'dsoId' : 'queue');
    }

    getValues() {
        return {
            group: this.dom.queueSelect?.dataset.value,
            regionId: this.dom.dsoSelect?.dataset.region,
            dsoId: this.dom.dsoSelect?.dataset.value
        };
    }
}