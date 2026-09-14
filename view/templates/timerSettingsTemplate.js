function renderNumberField({ id, label, span, min, max, value, enabled }) {
  return `
    <div class="settings-item g-10 flex-col">
      <label for="${id}">${label}</label>

      <div class="number-input-wrapper glass-panel p-8">
        <input
          type="number"
          id="${id}"
          min="${min}"
          max="${max}"
          step="1"
          value="${value}"
          ${enabled ? '' : 'disabled'}
        />
        <span class="number-input-suffix">хв</span>
      </div>

      <span class="secondary-text">${span}</span>
    </div>
  `;
}

export const renderTimerSettings = ({ enabled, numberFields }) => {
  const numberFieldsHTML = numberFields
    .map((f) => renderNumberField({ ...f, enabled }))
    .join('');

  const html =  `<div class="settings-wrapper p-10 flex-col g-20">
      <div class="settings-section flex-col g-10">
        <div class="settings-section-title secondary-text">
          Сповіщення
        </div>

        <div class="settings-group p-10 glass-panel">
          <div class="settings-item flex-between">
            <span>Сповіщення про відключення</span>
            <label class="custom-checkbox" for="notification-enabled">
              <input type="checkbox" id="notification-enabled" ${enabled ? 'checked' : ''} />
              <div class="slider round"></div>
            </label>
          </div>
        </div>

        <div class="settings-section-description thirdly-text">
          Отримуйте сповіщення про наближення
          запланованого відключення.
        </div>
      </div>

      <div class="settings-section flex-col g-10${enabled ? '' : ' disabled'}">
        <div class="settings-section-title secondary-text">
          Час сповіщень
        </div>

        <div class="notification-fields settings-group p-10 g-10 flex-row glass-panel" id="timer-settings-fields">
          ${numberFieldsHTML}
        </div>

        <div class="settings-section-description thirdly-text">
          Вкажіть, коли надсилати перше сповіщення
          та як часто повторювати його до початку відключення.
        </div>
      </div>
    </div>`;

    return html;
}

export const renderTimerSummary = ({ count, delay, frequency }) => {
  const html =  `<div class="notification-summary glass-panel glass-blur p-10" id="notification-summary">
      <span id="summary-count" class="summary-count-badge">${count}</span>
      <strong class="summary-highlight">сповіщення</strong> буде надіслано.<br>
      Перше — за <strong id="summary-delay" class="summary-highlight">${delay} хв</strong> до відключення,
      наступні сповіщення будуть кожні <strong id="summary-frequency" class="summary-highlight">${frequency} хв</strong>.
    </div>`;

    return html;
}