// ============================================================================
// МЕНЕДЖЕР ДРОПДАУНІВ ІНПУТІВ
// Відповідає виключно за UI дропдаунів
// ============================================================================
export class InputDropdownManager {
    constructor(dom, inputMap) {
        this.dom = dom;
        this.inputMap = inputMap;

        this.dropdowns = {
            city: { wrapper: null },
            street: { wrapper: null },
            house: { wrapper: null }
        };
    }

    #getLabel(value) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        return String(value.city ?? value.street ?? value.house ?? value.name ?? value.value ?? '');
    }

    create(type) {
        if (this.dropdowns[type].wrapper) return;

        const wrapper = document.createElement('div');
        wrapper.className = `select-options for-${type} z-999 glass-panel glass-blur`;

        const parentInput = this.dom[this.inputMap[type]];
        parentInput.parentElement.appendChild(wrapper);

        this.dropdowns[type].wrapper = wrapper;
    }

    render(type, options, onSelect) {
        this.create(type);

        const wrapper = this.dropdowns[type].wrapper;
        wrapper.innerHTML = '';

        const container = this.dom[this.inputMap[type]].closest('.custom-input');
        container.classList.add('open');

        options.forEach(option => {
            const div = document.createElement('div');
            div.className = 'option';
            div.textContent = this.#getLabel(option);
            div.addEventListener('click', () => onSelect(type, option));
            wrapper.appendChild(div);
        });
    }

    remove(type) {
        if (!this.dropdowns[type]?.wrapper) return;
        this.dropdowns[type].wrapper.remove();
        this.dropdowns[type].wrapper = null;
    }

    closeAll() {
        Object.keys(this.dropdowns).forEach(type => this.remove(type));
    }
}