export const renderAbout = (info) => {
    const html =  `<div class="modal-wrapper p-10 g-10 flex-col">
        <div class="section-content flex-between glass-panel">
          <div class="flex-center g-10">
            <div class="brand-icon large flex-center glass-panel">
              <div class="app-icon"></div>
            </div>
            <div class="flex-col g-3">
              <span class="main-text">${info.appname}</span>
              <span class="custom-text t11_px">Версія: ${info.version}</span>
            </div>
          </div>
          <button class="btn app-btn g-6 flex-center glass-panel hover-event" data-action="clearCache" title="Очистити кеш">
            <div class="btn-icon ic_clear"></div>
            <span class="cache-info custom-text t11_px">${info.cache.formatted}</span>
          </button>
        </div>

        <div class="section-content flex-col flex-between-only g-8 glass-panel">
          
          <div class="flex-between flex">
            <div class="flex-center g-10">
              <div class="icon ic_info"></div>
              <span class="custom-text t11_px">Версія</span>
            </div>
            <span class="t11_px">${info.version}</span>
          </div>

          <div class="divider"></div>

          <div class="flex-between flex">
            <div class="flex-center g-10">
              <div class="icon ic_calendar"></div>
              <span class="custom-text t11_px">Дата встановлення</span>
            </div>
            <span class="t11_px">${info.installDate}</span>
          </div>

          <div class="divider"></div>

          <div class="flex-between flex">
            <div class="flex-center g-10">
              <div class="icon ic_puzzle_piece"></div>
              <span class="custom-text t11_px">ID розширення</span>
            </div>
            <span class="t11_px">${info.shortId}</span>
          </div>

          <div class="divider"></div>

          <div class="flex-between flex">
            <div class="flex-center g-10">
              <div class="icon ic_shield"></div>
              <span class="custom-text t11_px">Дозволи</span>
            </div>
            <button class="dialog-btn small flex-center g-5" data-action="showPermissions">
              <span class="custom-text t11_px">Переглянути</span>
              <div class="arrow-icon _6px right"></div>
            </button>
          </div>

        </div>

        <button class="btn dialog-btn g-8 flex-center flex-row glass-panel default accent" data-action="checkUpdate" title="Перевірити оновлення">Перевірити оновлення<div class="btn-icon ic_refresh"></div></button>
        <div id="versionState" class="t11_px flex-center flex version-state ${info.versionMeta.css}">${info.versionMeta.text}</div>
      </div> `
      
      return html;
};