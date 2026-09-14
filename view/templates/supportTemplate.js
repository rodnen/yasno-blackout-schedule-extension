export const renderSupport = (owner) => {
  const html = `<div class="modal-wrapper p-10 g-10 flex-col">

      <div class="section-content flex-col g-10 glass-panel">
        <div class="flex-center g-10">
          <div class="flex-col g-3">
            <span class="main-text">Дякую, що ти тут</span>
            <span class="custom-text t11_px">
              Якщо ти відкрив цю сторінку — значить, тобі небайдуже те, що я роблю. 
              Я створюю та розвиваю це розширення, щоб воно залишалося зручним і корисним для тебе.
            </span>
          </div>
        </div>

        <div class="divider"></div>

        <span class="custom-text t11_px">
          Хочеш підтримати мою роботу фінансово або просто зробити мені приємне? 
          Буду дуже вдячний за будь-яку підтримку. 💛
        </span>
      </div>

      <div class="section-content flex-between glass-panel">
        <a href="https://donatello.to/${owner}" target="_blank"
           class="btn app-btn flex-center glass-panel w-full">
          <div class="icon ic_donatello_logo no-mask"></div>
        </a>

        <button class="btn app-btn flex-center glass-panel" data-action="showCrypto" data-type="btc">
          <div class="icon crypto ic_btc no-mask"></div>
        </button>

        <button class="btn app-btn flex-center glass-panel" data-action="showCrypto" data-type="eth">
          <div class="icon crypto ic_eth no-mask"></div>
        </button>

        <button class="btn app-btn flex-center glass-panel" data-action="showCrypto" data-type="usdt">
          <div class="icon crypto ic_usdt no-mask"></div>
        </button>
      </div>
    </div>`

  return html;
}
