import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../utils/utils.js';
import { getUpdateStateMeta } from '../utils/updateState.js';

export class VersionManager {
  constructor(dialogManager, messageManager) {
    this.dialogManager = dialogManager;
    this.messageManager = messageManager;
    this.init();
  }

  init() {
    this.dialogManager.onCheckUpdate = () => this.manualCheck();
    this.autoCheck();
  }

  /** Скільки ще чекати до наступної спроби (0, якщо можна перевіряти) */
  async #getRateLimitCooldownLeft() {
    const until = (await Utils.getStorageValue(CONSTANTS.RATE_LIMIT_UNTIL_KEY)) || 0;
    return Math.max(0, until - Date.now());
  }

  async autoCheck() {
    const cooldownLeft = await this.#getRateLimitCooldownLeft();
    if (cooldownLeft > 0) return; // все ще в бані — навіть не пробуємо

    const lastCheck = await Utils.getStorageValue(CONSTANTS.LAST_CHECK_KEY) || 0;
    const updateState = await Utils.getStorageValue(CONSTANTS.UPDATE_STATE_KEY);
    const latestVer = await Utils.getStorageValue(CONSTANTS.LATEST_VER_KEY);

    const now = Date.now();

    if (!lastCheck || updateState === undefined) {
      await this.performCheck(false);
      return;
    }

    if (now - lastCheck < CONSTANTS.CHECK_INTERVAL) {
      const isNewer = latestVer && Utils.semverCompare(latestVer, CONSTANTS.APP_VERSION) === 1;
      if (updateState === -1 && isNewer) {
        this.messageManager?.show({
          text: `Доступне оновлення: ${latestVer}`,
          icon: '🚀',
          type: 'info',
          id: 'update'
        });
      }
      return;
    }

    await this.performCheck(false);
  }

  async manualCheck() {
    await this.performCheck(true);
  }

  async performCheck(showResult) {
    const cooldownLeft = await this.#getRateLimitCooldownLeft();
    if (cooldownLeft > 0) {
      if (showResult) {
        const mins = Math.ceil(cooldownLeft / 60000);

        this.dialogManager.updateVersionState({
          css: 'state-warning',
          text: `Забагато запитів до GitHub. Спробуйте через ${mins} хв.`
        });
      }
      return;
    }

    let response;
    try {
      response = await Utils.sendMessage({
        action: 'checkUpdate',
        owner: CONSTANTS.OWNER,
        repo: CONSTANTS.REPO
      });
    } catch (error) {
      console.error('Update check request failed:', error);
      if (showResult) {
        this.dialogManager.updateVersionState({
          css: 'state-error',
          text: `Помилка при перевірці оновлень: ${error.message || 'Спробуйте пізніше'}`
        });
      }
      return;
    }

    const result = response?.result;

    if (!result) {
      console.error('Update check error: empty response');
      if (showResult) {
        this.dialogManager.updateVersionState({
          css: 'state-error',
          text: `Помилка при перевірці оновлень`
        });
      }
      return;
    }

    // --- Rate limit: окрема гілка, стан НЕ перезаписуємо ---
    if (result.rateLimited) {
      const resetAt = result.resetAt ?? (Date.now() + CONSTANTS.RATE_LIMIT_COOLDOWN);
      await Utils.setStorageData({ [CONSTANTS.RATE_LIMIT_UNTIL_KEY]: resetAt });

      if (showResult) {
        const mins = Math.ceil((resetAt - Date.now()) / 60000);
        this.dialogManager.updateVersionState({
          css: 'state-warning',
          text: `Забагато запитів до GitHub. Спробуйте через ${mins} хв.`
        });
      }
      return;
    }

    if (!result.success) {
      console.error('Update check error:', result);
      if (showResult) {
        this.dialogManager.updateVersionState({
          css: 'state-error',
          text: `Помилка при перевірці оновлень: ${result.error}`
        });
      }
      return;
    }

    // Успіх — знімаємо будь-який попередній rate-limit бан
    const cmp = Number(result.cmp);
    const latestVer = result.latestVer;
    
    await Utils.setStorageData({
      [CONSTANTS.LAST_CHECK_KEY]: Date.now(),
      [CONSTANTS.UPDATE_STATE_KEY]: cmp,
      [CONSTANTS.LATEST_VER_KEY]: latestVer,
      [CONSTANTS.RATE_LIMIT_UNTIL_KEY]: 0,
    });

    if (cmp === -1) {
      this.messageManager?.show({
        text: `Доступне оновлення: ${latestVer}`,
        icon: '🚀',
        type: 'info'
      });
    }

    if (showResult) {
      const meta = getUpdateStateMeta(cmp, latestVer);
      this.dialogManager.updateVersionState(meta);
    }
  }
}