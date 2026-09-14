import { Utils } from '../utils/utils.js';
import { MODE_STRATEGIES } from '../strategies/modeStrategies.js';
import { BoxView } from '../view/boxView.js';

const LOAD_DATA_MIN_INTERVAL_MS = 800;

// ============================================================================
// МЕНЕДЖЕР ДАНИХ
// ============================================================================
export class DataManager {
    #box;

    #lastRunAt = 0;
    #isRunning = false;
    #pendingCall = false;
    #throttleTimer = null;

    constructor(dom, selectManager, dateManager) {
        this.dom = dom;
        this.selectManager = selectManager;
        this.dateManager = dateManager;
        this.#box = new BoxView(dom);
    }

    async loadData() {
        const elapsed = Date.now() - this.#lastRunAt;

        if (this.#isRunning || elapsed < LOAD_DATA_MIN_INTERVAL_MS) {
            this.#pendingCall = true;
            this.#scheduleTrailingRun(Math.max(0, LOAD_DATA_MIN_INTERVAL_MS - elapsed));
            return;
        }

        await this.#runLoadData();
    }

    #scheduleTrailingRun(delay) {
        if (this.#throttleTimer) return;

        this.#throttleTimer = setTimeout(async () => {
            this.#throttleTimer = null;

            if (!this.#pendingCall) return;
            this.#pendingCall = false;

            await this.#runLoadData();
        }, delay);
    }

    async #runLoadData() {
        this.#isRunning = true;
        this.#lastRunAt = Date.now();

        try {
            await this.#fetchAndRender();
        } finally {
            this.#isRunning = false;

            if (this.#pendingCall) {
                this.#scheduleTrailingRun(LOAD_DATA_MIN_INTERVAL_MS);
            }
        }
    }

    async #fetchAndRender() {
        const modeKey = await Utils.getModeKey();
        const strategy = MODE_STRATEGIES[modeKey];

        if (!strategy) {
            console.error(`Unknown mode key: ${modeKey}`);
            this.#box.showError();
            return;
        }

        const { group, regionId, dsoId } = this.selectManager.getValues();
        if (!group) {
            this.#box.clearLoading();
            return;
        }

        const dayType = this.dateManager.dom.activeDateBtn?.dataset.type ?? 'today';
        const currentDayNumber = new Date().getDate();

        const context = { group, regionId, dsoId, dayType, currentDayNumber };
        const payload = strategy.buildPayload(context);

        try {
            const { success, html, updatedOn, outageDates, error } = await chrome.runtime.sendMessage(payload);

            if (!success) {
                this.#box.showError(error);
                return;
            }

            this.#box.setContent(html);
            this.#box.setUpdatedOn(updatedOn);
            this.#box.scrollToSelected();
        } catch (error) {
            console.error('[DataManager] loadData error:', error);
            this.#box.showError();
        }
    }

    scrollToCurrentElement() {
        this.#box.scrollToSelected();
    }
}