// ============================================================================
// КОНСТАНТИ
// ============================================================================
const DTEK_DNEM_ORIGIN_URL = 'https://www.dtek-dnem.com.ua/ua';
const DTEK_KEM_ORIGIN_URL = 'https://www.dtek-kem.com.ua/ua';

export const CONSTANTS = {
  APP_VERSION: chrome.runtime.getManifest().version,
  APP_NAME: 'Vydko Extension',

  //GIT HUB
  RATE_LIMIT_UNTIL_KEY: 'rateLimitUntil',
  RATE_LIMIT_COOLDOWN: 15 * 60 * 1000,
  OWNER: 'rodnen',
  REPO: 'yasno-blackout-schedule-extension',

  //APP CONSTANST
  INDICATOR_PADDING: 5,
  DEFAULT_QUEUE: 'all',
  DEFAULT_DSO_ID: 'none',
  REFRESH_ANIMATION_DURATION: 300,
  REFRESH_MIN_DURATION: 1500,
  THEMES: ['system', 'dark', 'light'],
  EASTER_EGG_DATES: Object.freeze({ today: 6, tomorrow: 7 }),
  EASTER_EGG_GIF: 'https://cdn.7tv.app/emote/01K91ZKMKBW0EA884967R3MHCM/1x.gif',
  CHECK_INTERVAL: 6 * 60 * 60 * 1000,
  
  //DSOI IDS
  DNEM_DSO_ID: { yasno: '301', dtek: 'dnem' },
  CEK_DSO_ID:  { yasno: '303', dtek: 'cek' },
  KEM_DSO_ID:  { yasno: '902', dtek: 'kem' },
  
  //LINKS
  YASNO_KYIV_URL: 'https://app.yasno.ua/api/blackout-service/public/shutdowns/regions/25/dsos/902/planned-outages',
  YASNO_KYIV_ADRESSES: 'https://app.yasno.ua/api/blackout-service/public/shutdowns/addresses/v2/regions',

  DTEK_DNEM_ORIGIN_URL,
  DTEK_KEM_ORIGIN_URL,

  DTEK_DNEM_AJAX_URL: `${DTEK_DNEM_ORIGIN_URL}/ajax`,
  DTEK_KEM_AJAX_URL: `${DTEK_KEM_ORIGIN_URL}/ajax`,

  DTEK_DNEM_SHUTDOWN_URL: `${DTEK_DNEM_ORIGIN_URL}/shutdowns`,
  DTEK_KEM_SHUTDOWN_URL: `${DTEK_KEM_ORIGIN_URL}/shutdowns`,

  //CACHE KEYS
  UPDATE_STATE_KEY: "lastUpdateKey",
  LAST_CHECK_KEY: "lastUpdateCheck",
  LATEST_VER_KEY: "lastVerKey",

  NOTIFICATION_ENABLED_KEY: "notificationEnabled",
  NOTIFICATION_DELAY_KEY: "notitficationDelay",
  NOTIFICATION_FREQUENCY_KEY: "notificationFrequency",
  NOTIFICATION_DATES_KEY: "notificationDates",
  NOTIFICATION_STATE_KEY: "notificationState",

  CACHE_KEY_PREFIX: 'cache:yasno:table',
  CACHE_TTL_MIN: 20,

  CACHE_TTL: Object.freeze({
    HOUSES: 24 * 60 * 60 * 1000,  // 24 год — список будинків по вулиці
    HOUSE_DATA: 30 * 60 * 1000,   // 30 хв  — дані про відключення
  }),

  CRYPTO_OPTIONS: {
    btc: { adress: "159QjydMa73R9qqceoN8hmHWjYNAKjeZ6y", qrcode: "ic_btc_qrcode", title: "Bitcoin" },
    eth: { adress: "0xdc6d0754de7d3a02a14ab3ca7f7b5a85db45dbec", qrcode: "ic_eth_qrcode", title: "Ethereum" },
    usdt: { adress: "TK59BTuZUJQiNJ4iQDPFSEx4na3vYqnxE2", qrcode: "ic_usdt_qrcode", title: "USDT" },
  },
}