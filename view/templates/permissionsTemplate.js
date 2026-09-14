export const renderPermissions = ({ hostPermissions, permissions }) => {
  const permissionIcons = {
    cookies: 'ic_cookie',
    storage: 'ic_database',
    unlimitedStorage: 'ic_database',
    tabs: 'ic_tabs',
    activeTab: 'ic_tab',
    scripting: 'ic_code',
    notifications: 'ic_bell',
    webRequest: 'ic_globe',
    webRequestBlocking: 'ic_shield',
    contextMenus: 'ic_menu',
    alarms: 'ic_alarm',
    downloads: 'ic_download',
    clipboardRead: 'ic_clipboard_read',
    clipboardWrite: 'ic_clipboard_write',
    identity: 'ic_user'
  };

  const permissionNames = {
    cookies: 'Доступ до Cookies',
    storage: 'Зберігання даних розширення',
    unlimitedStorage: 'Розширене зберігання даних',
    tabs: 'Доступ до вкладок',
    activeTab: 'Доступ до активної вкладки',
    scripting: 'Виконання скриптів на сторінках',
    notifications: 'Сповіщення',
    webRequest: 'Перегляд мережевих запитів',
    webRequestBlocking: 'Блокування мережевих запитів',
    contextMenus: 'Контекстне меню',
    alarms: 'Таймери та заплановані дії',
    downloads: 'Завантаження файлів',
    clipboardRead: 'Читання буфера обміну',
    clipboardWrite: 'Запис у буфер обміну',
    identity: 'Доступ до облікового запису'
  };

  const formatHost = (host) => {
    return host
      .replace(/^https?:\/\//, '')
      .replace(/\/\*$/, '');
  };

  function getHostIcon(host) {
    const lowerHost = host.toLowerCase();

    if (lowerHost.includes('dtek')) return 'ic_dtek no-mask';
    if (lowerHost.includes('yasno')) return 'ic_yasno no-mask';

    return 'ic_globe';
  }

  const getPermissionIcon = (permission) => {
    return permissionIcons[permission] || 'ic_shield';
  };

  const getPermissionName = (permission) => {
    return permissionNames[permission] || permission;
  };

  const hostRows = hostPermissions.length
    ? hostPermissions.map((host, index) => `
        ${index > 0 ? '<div class="divider"></div>' : ''}

        <div class="flex-between flex">
          <div class="flex-center g-10">
            <div class="icon ${getHostIcon(host)}"></div>
            <span class="custom-text t11_px">
              ${formatHost(host)}
            </span>
          </div>

          <div class="flex-center g-5 access-allowed">
            <div class="icon ic_check"></div>
            <span class="custom-text t11_px">
              Дозволено
            </span>
          </div>
        </div>
      `).join('')
    : `
        <div class="flex-center">
          <span class="custom-text t11_px">
            Немає дозволів до сайтів
          </span>
        </div>
      `;

  const permissionRows = permissions.length
    ? permissions.map((permission, index) => `
        ${index > 0 ? '<div class="divider"></div>' : ''}

        <div class="flex-between flex">
          <div class="flex-center g-10">
            <div class="icon ${getPermissionIcon(permission)}"></div>

            <span class="custom-text t11_px">
              ${getPermissionName(permission)}
            </span>
          </div>

          <div class="flex-center access-allowed g-5">
            <div class="icon ic_check"></div>
            <span class="custom-text t11_px">
              Дозволено
            </span>
          </div>
        </div>
      `).join('')
    : `
        <div class="flex-center">
          <span class="custom-text t11_px">
            Немає спеціальних дозволів
          </span>
        </div>
      `;

  const html = `<div class="modal-wrapper p-10 g-10 flex-col">

      <div class="section-content flex-col flex-between-only g-10 glass-panel";">

        <div class="flex-center g-10">
          <div class="section-icon glass-panel p-3">
            <div class="icon ic_globe p-3"></div>
          </div>

          <div class="flex-col flex g-3">
            <span class="main-text">
              Доступ до сайтів
            </span>
            <span class="custom-text t11_px">
              Розширення має доступ до наступних сайтів.
            </span>
          </div>
        </div>

        <div class="divider"></div>

        ${hostRows}
        
      </div>

      <div class="section-content flex-col flex-between-only g-10 glass-panel">

        <div class="flex-center g-10">
          <div class="section-icon glass-panel p-3">
            <div class="icon ic_lock p-3"></div>
          </div>
          
          <div class="flex-col flex g-3">
            <span class="main-text">
              Дозволи розширення
            </span>
            <span class="custom-text t11_px">
              Дозволи, необхідні для роботи розширення.
            </span>
          </div>
        </div>

        <div class="divider"></div>

        ${permissionRows}

      </div>

      <div class="section-content flex-center g-10 glass-panel">

        <div class="icon ic_info"></div>

        <span class="custom-text t11_px">
          Розширення використовує лише дозволи,
          необхідні для його роботи.
        </span>

      </div>

    </div>`

  return html;
}