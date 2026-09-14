import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
// ============================================================================
// МЕНЕДЖЕР ТЕМИ
// ============================================================================
export class ThemeManager {
  constructor(dom) {
    this.dom = dom;
    this.themes = CONSTANTS.THEMES;
  }

  async init() {
    const { theme } = await Utils.getStorageData(['theme']);
    this.applyTheme(theme || 'system');
  }

  async toggleTheme() {
    const { theme } = await Utils.getStorageData(['theme']);
    const current = theme || 'system';
    const next = this.getNextTheme(current);
    await Utils.setStorageData({ theme: next });
    this.applyTheme(next);
  }

  getNextTheme(current) {
    const index = this.themes.indexOf(current);
    return this.themes[(index + 1) % this.themes.length];
  }

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
    this.#updateButtonUI(theme);
  }

  #updateButtonUI(theme) {
    if (!this.dom.themeBtn) return;

    const icon = this.dom.themeBtn.querySelector('.menu-icon');
    const text = this.dom.themeBtn.querySelector('span:last-child');

    const map = {
      system: { icon: '🖥️', text: 'Системна' },
      dark: { icon: '🌙', text: 'Темна' },
      light: { icon: '☀️', text: 'Світла' }
    };

    if (icon) icon.textContent = map[theme].icon;
    if (text) text.textContent = map[theme].text;
  }
}