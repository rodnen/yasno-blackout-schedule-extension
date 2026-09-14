import { Utils } from '../utils/utils.js';

export class BoxView {
    #box;
    #footer;

    constructor(dom) {
        this.dom = dom;
        this.#box = dom.box;
        this.#footer = dom.footer;
    }

    showLoading(message = 'Йде завантаження…') {
        this.#box.classList.remove('error', 'flex-center');
        this.#box.classList.add('loading', 'flex-center');
        this.#box.innerHTML = `<div class="loading-wrapper g-10 flex-center flex-row"><div class="loader"></div><p>${message}</p></div>`;
    }

    showError(error) {
        this.#box.classList.remove('loading', 'flex-center');
        this.#box.classList.add('error', 'flex-center');
        this.#box.innerHTML = Utils.buildLoadErrorHTML(error);
    }

    setContent(html) {
        this.#box.classList.remove('loading', 'flex-center');
        this.#box.classList.remove('error', 'flex-center');
        this.#box.innerHTML = html;
    }

    setUpdatedOn(updatedOn) {
        let container = this.#footer.querySelector('.updated-wrapper');

        if (updatedOn == null) {
            if (!container) return;

            const el = container.querySelector('.updated-on');

            const collapse = () => {
                container.style.width = '0px';
                container.classList.remove('is-expanded');
                container.addEventListener('transitionend', (e) => {
                    if (e.target === container) container.remove();
                }, { once: true });
            };

            if (el) {
                el.classList.remove('is-visible');
                el.addEventListener('transitionend', (e) => {
                    if (e.target === el) collapse();
                }, { once: true });
            } else {
                collapse();
            }
            return;
        }

        if (!container) {
            container = document.createElement('div');
            container.className = 'updated-wrapper';
            this.#footer.prepend(container);

            const el = document.createElement('div');
            el.className = 'updated-on glass-panel secondary-text';
            el.textContent = Utils.formatUpdatedOn(updatedOn);
            container.appendChild(el);

            const width = el.getBoundingClientRect().width;

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    container.style.width = `${width}px`;
                    container.classList.add('is-expanded');

                    container.addEventListener('transitionend', (e) => {
                        if (e.target !== container) return;
                        requestAnimationFrame(() => el.classList.add('is-visible'));
                    }, { once: true });
                });
            });
            return;
        }

        let el = container.querySelector('.updated-on');
        if (!el) {
            el = document.createElement('div');
            el.className = 'updated-on glass-panel secondary-text';
            container.appendChild(el);
        }
        el.textContent = Utils.formatUpdatedOn(updatedOn);

        const width = el.getBoundingClientRect().width;
        container.style.width = `${width}px`;

        if (!container.classList.contains('is-expanded')) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    container.classList.add('is-expanded');
                    container.addEventListener('transitionend', (e) => {
                        if (e.target !== container) return;
                        requestAnimationFrame(() => el.classList.add('is-visible'));
                    }, { once: true });
                });
            });
        } else {
            requestAnimationFrame(() => el.classList.add('is-visible'));
        }
    }

    /** Знімає лише індикатор завантаження. НЕ чіпає клас 'error' —
     *  його знімає тільки showLoading()/setContent(), тобто коли
     *  реально стартував новий процес або прийшли валідні дані. */
    clearLoading() {
        this.#box.classList.remove('loading', 'flex-center');
    }

    /** Явне скидання стану помилки (якщо колись знадобиться окремо). */
    clearError() {
        this.#box.classList.remove('error', 'flex-center');
    }

    scrollToTop() {
        this.#box.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /** Прокручує до вибраного рядка таблиці, якщо він далеко від верху; інакше — просто нагору. */
    scrollToSelected(selector = '._table_current_selected', minIndex = 4) {
        const el = this.#box.querySelector(selector);
        const index = el?.dataset.index !== undefined ? Number(el.dataset.index) : null;

        if (el && index !== null && index >= minIndex) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            this.scrollToTop();
        }
    }
}