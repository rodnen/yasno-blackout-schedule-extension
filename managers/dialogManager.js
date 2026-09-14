import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { DialogView } from '../view/dialogView.js';
import { renderAbout } from '../view/templates/aboutTemplate.js';
import { renderPermissions } from '../view/templates/permissionsTemplate.js';
import { renderSupport } from '../view/templates/supportTemplate.js';
import { renderBugReportStep } from '../view/templates/bugReportTemplate.js';
import { renderTimerSettings, renderTimerSummary } from '../view/templates/timerSettingsTemplate.js';
import { renderCrypto } from '../view/templates/cryptoTemplate.js';

// ============================================================================
// МЕНЕДЖЕР ДІАЛОГІВ
// Відповідає ВИКЛЮЧНО за логіку: які кроки показувати, як валідувати поля,
// що робити при сабміті. Весь рендеринг і робота з DOM делеговані у DialogView.
// ============================================================================
export class DialogManager {

  #view;
  #messageManager;

  constructor(dom, messageManager) {
    this.#messageManager = messageManager;
    this.onCheckUpdate = null;

    this.#view = new DialogView(dom);
    this.#view.setBaseActionHandler((action) => {
      if (action === 'checkUpdate') this.onCheckUpdate?.();
    });
  }

  updateVersionState({ css, text }) {
    const el = this.#view.query('#versionState');
    if (!el) return;

    el.className = `t11_px flex-center flex version-state ${css}`;
    el.textContent = text;
  }

  // ---------------------------------------------------------------------
  // Проксі до візуального шару (щоб не ламати зовнішній API класу)
  // ---------------------------------------------------------------------

  showDialog() {
    this.#view.showDialog();
  }

  closeDialog() {
    this.#view.closeDialog();
  }

  updateTitle(title) {
    this.#view.updateTitle(title);
  }

  updateContent(content, isHTML = false) {
    this.#view.updateContent(content, isHTML);
  }

  updateDialog(title, content, isHTML = false) {
    this.#view.updateDialog(title, content, isHTML);
  }

  appendFooter(content = null) {
    this.#view.appendFooter(content);
  }

  removeFooter() {
    this.#view.removeFooter();
  }

  replaceFooter(content) {
    this.#view.replaceFooter(content);
  }

  #handleAboutClick(e, info) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'clearCache':
        this.#handleClearCache(actionEl);
        break;
      case 'showPermissions':
        this.showPermissions({
          hostPermissions: info.hostPermissions,
          permissions: info.permissions
        });
        break;
    }
  }

  async #handleSupportClick(e) {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'showCrypto':
        this.showCrypto(actionEl.dataset.type);
        break;

      case 'copyAddress': {
        const success = await Utils.copyStaticText(actionEl.dataset.address);

        if (success) {
          this.#toast('Успішно скопійовано', 'success', 'ic_check', 3000);
        } else {
          this.#toast('Не вдалося скопіювати', 'error', 'ic_error', 3000);
        }

        break;
      }
    }
  }

  async #handleClearCache(cacheBtn) {
    const { success, removed } = await Utils.sendMessage({ action: 'clearAllCache' });
    if (!success) return;

    const cache = await Utils.getStorageSize();
    cacheBtn.querySelector('.cache-info').innerText = cache.formatted;

    this.#toast(`Кеш очищено (${removed})`, 'success', 'ic_check', 2000);
  }

  // ---------------------------------------------------------------------
  // Спільні хелпери логіки
  // ---------------------------------------------------------------------

  #toast(text, type, icon, duration = 3000, emotional = false) {
    return this.#messageManager?.showToast({ text, type, icon, duration, emotional });
  }

  #hideToast(toastId) {
    if (toastId) this.#messageManager?.hideToast(toastId);
  }

  /**
   * Виконує асинхронну дію кнопки з блокуванням на час запиту.
   * Сама відновлює кнопку і показує тост у разі помилки.
   * Повертає true при успіху, false при помилці (щоб викликач міг скинути свій прапор isSubmitting).
   */
  async #runButtonAction(btn, { loadingText, idleText, action, errorPrefix }) {
    btn.disabled = true;
    btn.innerHTML = loadingText;

    try {
      await action();
      return true;
    } catch (error) {
      this.#toast(`${errorPrefix}: ${error.message || 'Спробуйте ще раз'}`, 'error', 'ic_error', 5000, true);
      console.error(errorPrefix, error);

      btn.disabled = false;
      btn.innerHTML = idleText;
      return false;
    }
  }

  // ---------------------------------------------------------------------
  // About dialog
  // ---------------------------------------------------------------------

  showAbout(info) {
    this.#view.updateDialog('Про розширення', renderAbout(info), true);
    this.#view.attachStepHandler((e) => this.#handleAboutClick(e, info));
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Permission dialog
  // ---------------------------------------------------------------------

  showPermissions({ hostPermissions, permissions }) {
    this.#view.updateDialog('Дозволи', renderPermissions({ hostPermissions, permissions }), true, false, true);
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Support dialog
  // ---------------------------------------------------------------------

  showSupport() {
    this.#view.updateDialog('Підтримка', renderSupport(CONSTANTS.OWNER), true);
    this.#view.attachStepHandler((e) => this.#handleSupportClick(e));
    this.#view.showDialog();
  }

  // ---------------------------------------------------------------------
  // Crypto dialog
  // ---------------------------------------------------------------------
  showCrypto(type) {
    const option = CONSTANTS.CRYPTO_OPTIONS[type];

    if (!option) {
      console.warn(`Невідомий тип криптовалюти: ${type}`);
      return;
    }

    this.#view.updateDialog(option.title, renderCrypto(option.adress, option.qrcode), true, false, true);
    this.#view.showDialog();
  }


  // ---------------------------------------------------------------------
  // Bug report dialog (2-step wizard)
  // ---------------------------------------------------------------------

  showBugReport(onSubmit) {
    const saved = ['', ''];
    let isSubmitting = false;

    const mkValidation = ({ requiredMsg, min, minMsg, max, maxMsg }) => ({
      required: true,
      minLength: min,
      maxLength: max,
      messages: { required: requiredMsg, minLength: minMsg, maxLength: maxMsg }
    });

    const steps = [
      {
        fieldId: 'bug-message',
        title: 'Опис проблеми',
        hint: 'Опишіть, що сталося та за яких умов виникла помилка.',
        placeholder: 'Наприклад: не відкривається налаштування при кліку на...',
        validation: mkValidation({
          requiredMsg: 'Опишіть проблему',
          min: 10,
          minMsg: 'Мінімум 10 символів',
          max: 500,
          maxMsg: 'Занадто довге повідомлення'
        }),

        footer: {
          left: {
            action: 'cancel-bug',
            text: 'Скасувати',
            variant: 'cancel-btn',
            title: 'Скасувати'
          },

          right: {
            action: 'forward-bug',
            text: 'Далі',
            variant: 'forward-btn',
            icon: 'right',
            title: 'Далі'
          }
        }
      },

      {
        fieldId: 'bug-stack',
        title: 'Кроки для відтворення',
        hint: 'Опишіть послідовність дій, після яких виникає проблема.\nЧим точніше описані кроки, тим легше відтворити помилку.',
        placeholder: '1. Відкрив сторінку X\n2. Натиснув кнопку Y\n3. З\'явилась помилка...',

        validation: mkValidation({
          requiredMsg: 'Опишіть кроки для відтворення',
          min: 30,
          minMsg: 'Мінімум 30 символів',
          max: 1000,
          maxMsg: 'Занадто довгий опис дій'
        }),

        footer: {
          left: {
            action: 'back-bug',
            text: 'Назад',
            variant: 'back-btn',
            icon: 'left',
            title: 'Назад'
          },

          right: {
            action: 'send-bug',
            text: 'Надіслати',
            title: 'Надіслати'
          }
        }
      }
    ];

    const validateField = (field, validation) => {
      const value = field.value.trim();
      if (!value && validation.required) return validation.messages.required;
      if (validation.minLength && value.length < validation.minLength) return validation.messages.minLength;
      if (validation.maxLength && value.length > validation.maxLength) return validation.messages.maxLength;
      return null;
    };

    const renderStep = (index) => {
      const step = steps[index];
      const { fieldId, footer, validation } = step
      this.#view.updateDialog(
        'Повідомити про помилку',
        renderBugReportStep(step),
        true,
        true
      );


      this.#view.replaceFooter(this.#view.buildFooterButtons(footer));
      this.#view.showDialog();

      const field = this.#view.query(`#${fieldId}`);
      const counter = this.#view.query(`[data-field="${fieldId}"].char-counter`);

      if (saved[index]) field.value = saved[index];

      const updateCounter = () => {
        const len = field.value.length;
        if (counter) {
          counter.textContent = `${len}/${validation.maxLength}`;
          counter.classList.toggle('warning', len > validation.maxLength * 0.9);
          counter.classList.toggle('error', len > validation.maxLength);
        }
        Utils.clearErrorTextarea(field);
      };

      field.addEventListener('input', updateCounter);
      updateCounter();

      const handler = async (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === 'cancel-bug') {
          this.#view.closeDialog();
          this.#toast('Відправку скасовано', 'info', 'ic_info', 2000);
          return;
        }

        if (action === 'back-bug') {
          saved[index] = field.value.trim();
          renderStep(0);
          return;
        }

        const validationError = validateField(field, validation);
        if (validationError) {
          this.#toast(validationError, 'error', 'ic_error', 2500, true);
          Utils.setErrorTextarea(field);
          field.focus();
          return;
        }

        if (action === 'forward-bug') {
          saved[index] = field.value.trim();
          renderStep(1);
          return;
        }

        if (action === 'send-bug') {
          if (isSubmitting) return;
          isSubmitting = true;
          const modeKey = await Utils.getModeKey();

          const reportData = {
            error: saved[0],
            stack: field.value.trim(),
            mode: modeKey,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: `${screen.width}x${screen.height}`,
            version: chrome.runtime.getManifest().version,
            timestamp: new Date().toISOString()
          };

          const sendingToastId = this.#toast('Надсилання звіту...', 'info', null, 10000);

          const ok = await this.#runButtonAction(btn, {
            loadingText: 'Надсилання...',
            idleText: 'Надіслати',
            errorPrefix: 'Помилка відправки звіту',
            action: () => onSubmit?.(reportData)
          });

          this.#hideToast(sendingToastId);

          if (ok) {
            this.#toast('Звіт успішно відправлено! Дякуємо', 'success', 'ic_check', 4000);
            this.#view.closeDialog();
          } else {
            isSubmitting = false;
          }
        }
      };

      this.#view.attachStepHandler(handler);
    };

    renderStep(0);
  }

  // ---------------------------------------------------------------------
  // Timer settings dialog
  // ---------------------------------------------------------------------

  /**
 * Показує діалог налаштування таймера сповіщень.
 *
 * @param {{delay:number, frequency:number, enabled:boolean}} currentSettings
 *   Поточні значення у хвилинах.
 * @param {(settings:{enabled:boolean, delay:number, frequency:number}) => Promise<void>|void} onSave
 *   Викликається з новими налаштуваннями після підтвердження.
 */
  showTimerSettings(currentSettings = {}, onSave) {
    let isSubmitting = false;
    const enabled = currentSettings.enabled ?? false;

    const numberFields = [
      { id: 'timer-delay', label: 'Нагадати за', span: 'до початку', min: 1, max: 180, value: currentSettings.delay ?? 30 },
      { id: 'timer-frequency', label: 'Інтервал', span: 'між сповіщеннями', min: 1, max: 180, value: currentSettings.frequency ?? 15 }
    ];

    const initialDelay = currentSettings.delay ?? 30;
    const initialFrequency = currentSettings.frequency ?? 15;
    const initialCount = Math.max(1, Math.ceil(initialDelay / initialFrequency)) + 1;

    // ---- Рендер тіла та футера через темплейти ----

    this.#view.updateDialog(
      'Налаштування сповіщень',
      renderTimerSettings({ enabled, numberFields }),
      true,
      true
    );

    const footer = {
      info: {
        action: 'showInfo',
        content: renderTimerSummary({ count: initialCount, delay: initialDelay, frequency: initialFrequency })
      },
      left: { action: 'cancel-timer', text: 'Скасувати', variant: 'cancel-btn', title: 'Скасувати' },
      right: { action: 'save-timer', text: 'Зберегти', title: 'Зберегти' }
    };
    this.#view.replaceFooter(this.#view.buildFooterButtons(footer));
    this.#view.showDialog();

    // ---- DOM-посилання ----

    const enabledCheckbox = this.#view.query('#notification-enabled');
    const enabledLabel = this.#view.query('.custom-checkbox');
    const inputs = numberFields.map(f => this.#view.query(`#${f.id}`));

    // ---- Логіка стану (без змін) ----

    const updateSummary = () => {
      const summaryEl = this.#view.query('#notification-summary');
      if (!summaryEl) return;

      const delay = parseInt(inputs[0].value, 10) || 0;
      const freq = parseInt(inputs[1].value, 10) || 1;
      const count = Math.max(1, Math.ceil(delay / freq)) + 1;

      summaryEl.querySelector('#summary-count').textContent = count;
      summaryEl.querySelector('#summary-delay').textContent = `${delay} хв`;
      summaryEl.querySelector('#summary-frequency').textContent = `${freq} хв`;
    };

    const applyEnabledState = () => {
      const isEnabled = enabledCheckbox.checked;
      inputs.forEach((input) => {
        input.disabled = !isEnabled;
        input.closest('.settings-item').classList.toggle('disabled', !isEnabled);
        input.closest('.settings-section').classList.toggle('disabled', !isEnabled);
        if (!isEnabled) input.classList.remove('error');
      });
      updateSummary();
    };

    enabledLabel.addEventListener('click', (e) => {
      e.preventDefault();
      enabledCheckbox.checked = !enabledCheckbox.checked;
      applyEnabledState();
    });

    inputs.forEach((input) => {
      input.addEventListener('input', () => {
        input.classList.remove('error');
        updateSummary();
      });
    });

    const validateInputs = () => {
      if (!enabledCheckbox.checked) {
        return { enabled: false, delay: Number(inputs[0].value), frequency: Number(inputs[1].value) };
      }

      for (let i = 0; i < numberFields.length; i++) {
        const { label, min, max } = numberFields[i];
        const input = inputs[i];
        const raw = input.value.trim();
        const num = Number(raw);

        input.classList.remove('error');

        if (raw === '' || Number.isNaN(num) || !Number.isInteger(num)) {
          this.#toast(`«${label}»: введіть ціле число`, 'error', 'ic_error', 2500);
          input.classList.add('error');
          input.focus();
          return null;
        }
        if (num < min || num > max) {
          this.#toast(`«${label}»: значення має бути від ${min} до ${max}`, 'error', 'ic_error', 2500);
          input.classList.add('error');
          input.focus();
          return null;
        }
      }

      return {
        enabled: true,
        delay: Number(inputs[0].value),
        frequency: Number(inputs[1].value)
      };
    };

    const handler = async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'cancel-timer') {
        this.#view.closeDialog();
        this.#toast('Зміни скасовано', 'info', 'ic_info', 2000);
        return;
      }

      if (action === 'save-timer') {
        if (isSubmitting) return;

        const settings = validateInputs();
        if (!settings) return;

        isSubmitting = true;

        const ok = await this.#runButtonAction(btn, {
          loadingText: 'Збереження...',
          idleText: 'Зберегти',
          errorPrefix: 'Помилка збереження налаштувань',
          action: () => onSave?.(settings)
        });

        if (ok) {
          this.#toast('Налаштування сповіщень збережено', 'success', 'ic_check', 3000);
          this.#view.closeDialog();
        } else {
          isSubmitting = false;
        }
      }
    };

    this.#view.attachStepHandler(handler);
  }
}
