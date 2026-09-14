// ============================================================================
// МЕНЕДЖЕР ПОВІДОМЛЕНЬ
// ============================================================================
export class MessageManager {
    #maxToastCount = 5;
    #activeToasts = new Map();
    #defaultDuration = 3000;

    #elements = {
        header: null,
        container: null
    };

    constructor(dom = {}) {
        this.#elements.header = dom.header || document.querySelector('header');
        this.#initContainer();
    }

    show({ text = '', icon = 'ℹ️', type = 'info', id = 'default', closable = true } = {}) {
        if (!this.#elements.header) return null;
        let block = this.#elements.header.querySelector(`.message-block[data-id="${id}"]`);

        if (block) {
            this.#updateMessageBlock(block, { text, icon, type });
            return block;
        }

        block = this.#createMessageElement({ text, icon, type, id, closable });
        this.#elements.header.prepend(block);

        requestAnimationFrame(() => {
            block.style.opacity = '1';
            block.style.transform = 'translateY(0)';
        });

        return block;
    }

    showToast({
        text = '',
        icon = 'ic_info',
        type = 'info',
        id = null,
        duration = this.#defaultDuration,
        emotional = false
    } = {}) {
        if (this.#activeToasts.size >= this.#maxToastCount) {
            const oldestId = this.#activeToasts.keys().next().value;
            this.hideToast(oldestId);
        }

        const toastId = id ?? `toast-${Date.now()}-${Math.random()}`;

        if (id && this.#activeToasts.has(id)) {
            this.#updateToast(id, { text, icon, type, emotional });
            return toastId;
        }

        const messageText = emotional && this.#activeToasts.size >= 1
            ? this.#addEmotionalEnding(text)
            : text;

        const toast = this.#createToastElement({
            text: messageText,
            icon,
            type,
            id: toastId
        });

        this.#elements.container.appendChild(toast);

        const timerId = setTimeout(() => this.hideToast(toastId), duration);
        this.#activeToasts.set(toastId, { element: toast, timerId });

        requestAnimationFrame(() => toast.classList.add('show'));

        return toastId;
    }

    hideToast(id) {
        const toastData = this.#activeToasts.get(id);
        if (!toastData) return;

        const { element, timerId } = toastData;
        clearTimeout(timerId);

        element.classList.remove('show');
        element.addEventListener('transitionend', () => {
            element.remove();
            this.#activeToasts.delete(id);
        }, { once: true });
    }

    hide(block) {
        if (!block) return;

        block.style.opacity = '0';
        block.style.transform = 'translateY(-10px)';

        block.addEventListener('transitionend', () => block.remove(), { once: true });
    }

    clearAllToasts() {
        this.#activeToasts.forEach((_, id) => this.hideToast(id));
    }

    clearHeader() {
        if (!this.#elements.header) return;
        const blocks = this.#elements.header.querySelectorAll('.message-block');
        blocks.forEach(block => this.hide(block));
    }

    #initContainer() {
        let container = document.querySelector('.validator-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'validator-container z-999 flex-col-rev flex-center g-10';
            document.body.appendChild(container);
        }
        this.#elements.container = container;
    }

    #createMessageElement({ text, icon, type, id, closable }) {
        const block = document.createElement('div');
        block.className = 'message-block';
        block.dataset.id = id;
        block.style.cssText = 'opacity: 0; transform: translateY(-10px); transition: all 0.2s ease;';

        const item = document.createElement('div');
        item.className = `message-item g-075 message-${type}`;

        const iconEl = document.createElement('span');
        iconEl.className = 'message-icon';
        iconEl.innerHTML = icon;

        const content = document.createElement('div');
        content.className = 'message-content flex-between';

        const textEl = document.createElement('span');
        textEl.textContent = text;
        content.appendChild(textEl);

        item.append(iconEl, content);

        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'cross-icon flex-center';
            closeBtn.innerText = '❌';
            closeBtn.title = 'Закрити';
            closeBtn.setAttribute('aria-label', 'Закрити');
            closeBtn.addEventListener('click', () => this.hide(block), { once: true });
            item.appendChild(closeBtn);
        }

        block.appendChild(item);
        return block;
    }

    #createToastElement({ text, icon, type, id }) {
        const toast = document.createElement('div');
        toast.className = `toast-msg glass-panel g-8 flex-center toast-${type}`;
        toast.dataset.id = id;

        if (icon) {
            const iconEl = document.createElement('span');
            iconEl.className = `toast-icon ${icon}`;
            toast.appendChild(iconEl);
        }

        const textEl = document.createElement('span');
        textEl.className = 'toast-text';
        textEl.textContent = text;
        toast.appendChild(textEl);

        return toast;
    }

    #updateMessageBlock(block, { text, icon, type }) {
        const item = block.querySelector('.message-item');
        const iconEl = block.querySelector('.message-icon');
        const textEl = block.querySelector('.message-content span');

        if (item) item.className = `message-item g-075 message-${type}`;
        if (iconEl) iconEl.innerHTML = icon;
        if (textEl) textEl.textContent = text;
    }

    #updateToast(id, { text, icon, type, emotional }) {
        const { element } = this.#activeToasts.get(id);
        const iconEl = element.querySelector('.toast-icon');
        const textEl = element.querySelector('.toast-text');

        element.className = `toast-msg glass-panel g-8 flex-center toast-${type} show`;
        if (iconEl) iconEl.classList.add(icon);
        if (textEl) textEl.textContent = emotional ? this.#addEmotionalEnding(text) : text;
    }

    #addEmotionalEnding(text) {
        const endings = ['!', '>:(', '😤', '💢', '🤬', '!! 😠', '😡💥'];
        const randomEnding = endings[Math.floor(Math.random() * endings.length)];
        return `${text} ${randomEnding}`;
    }
}