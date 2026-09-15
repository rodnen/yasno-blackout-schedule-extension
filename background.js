// background.js
import { CONSTANTS } from './config/constants.js';
import { NotificationScheduler } from './managers/NotificationScheduler.js';
import { Utils } from './utils/utils.js';
import { YasnoAddressApi } from './services/api/Yasnoaddressapi.js';
import { DtekAddressApi } from './services/api/DtekAddressApi.js';

const CURRENT_VERSION = chrome.runtime.getManifest().version;

const DEFAULT_PARAMS = {
  dnem: {
    city: 'м. Дніпро',
    street: 'тупик Шкільний'
  },

  kem: {
    city: null,
    street: 'бул. Шевченка Тараса'
  }
};

const ALARM_NAME = 'checkOutageNotifications';

const dtekApiInstances = {
  dnem: new DtekAddressApi('dnem'),
  kem: new DtekAddressApi('kem'),
};

function isYasnoType(type) {
  return type === 'yasno';
}

function getDtekApi(type) {
  const api = dtekApiInstances[type];
  if (!api) {
    throw new Error(`Невідомий тип DTEK: "${type}". Очікується "dnem" або "kem".`);
  }
  return api;
}

async function isNotificationsEnabled() {
  const { [CONSTANTS.NOTIFICATION_ENABLED_KEY]: enabled } =
    await Utils.getStorageData([CONSTANTS.NOTIFICATION_ENABLED_KEY]);
  return !!enabled;
}

async function syncAlarmState() {
  const enabled = await isNotificationsEnabled();
  const existing = await chrome.alarms.get(ALARM_NAME);

  if (enabled && !existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
    console.log("[Notifications] Alarm started");
  } else if (!enabled && existing) {
    chrome.alarms.clear(ALARM_NAME);
    console.log("[Notifications] Alarm stopped");
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  syncAlarmState();

  if (details.reason === 'install') {
    const installDate = Date.now();
    await chrome.storage.sync.set({ installDate });
  }
});

chrome.runtime.onStartup.addListener(() => {
  syncAlarmState();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    NotificationScheduler.checkUpcoming();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (CONSTANTS.NOTIFICATION_ENABLED_KEY in changes) {
    syncAlarmState();
    return;
  }

  const relevant = [
    CONSTANTS.NOTIFICATION_DELAY_KEY,
    CONSTANTS.NOTIFICATION_FREQUENCY_KEY,
  ];

  if (relevant.some(key => key in changes)) {
    NotificationScheduler.checkUpcoming();
  }
});

// Конвертує хвилини доби + ISO-дату дня у Date
function slotMinutesToTimestamp(isoDateString, minutes) {
  const d = new Date(isoDateString);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + minutes * 60000;
}

function buildSlotHTML({ turn = null, start, end, isOutage, isOutdated, isNow, slotIndex, size }) {
  if ((!isOutage && slotIndex === 0 && size === 1 && !isOutdated && turn === null)) {
    return null;
  }
  return `
    <div class="_table_element flex-between glass-panel glass-blur${isOutage ? ' outage' : ''}${isNow ? ' selected' : ''}" data-index="${turn}">
      <div style="flex: 1;">
        <div class="_outage_time g-5">
          ${isNow ? `<div class="_table_current_selected"></div>` : ''}
          <span>${Utils.minutesToTime(start)} - ${Utils.minutesToTime(end)}</span>
        </div>
        <div class="_outage_type">
          ${isOutage ? 'Світла немає' : 'Світло є'}
        </div>
      </div>
      ${isOutage ? `<div class="outage_icon"></div>` : ''}
      ${turn !== null ? `<span class="group-number-text">${turn}</span>` : ''}
    </div>
  `;
}

/* ---------- кешування ---------- */
function cacheKey(cacheParts) {
  if (Array.isArray(cacheParts)) {
    return [CONSTANTS.CACHE_KEY_PREFIX, ...cacheParts].join(':');
  }
  const sortedParts = Object.keys(cacheParts).sort().map(k => cacheParts[k]);
  return [CONSTANTS.CACHE_KEY_PREFIX, ...sortedParts].join(':');
}

async function getCached(cacheParts) {
  const key = cacheKey(cacheParts);
  const stored = await Utils.getStorageData(key)
  if (!stored[key]) return null;

  const { ts, html } = stored[key];
  const valid = Date.now() - ts < CONSTANTS.CACHE_TTL_MIN * 60 * 1000;

  if (!valid) {
    await Utils.removeStorageData(key);
    return null;
  }
  return html;
}

async function setCached(cacheParts, html) {
  const key = cacheKey(cacheParts);
  await Utils.setStorageData({ [key]: { ts: Date.now(), html } });
}

// Окремі ключі для сирих даних ДТЕК
async function getCachedDTEKRawData(type) {
  const key = `dtek:raw:data-${type}`;
  const stored = await Utils.getStorageData(key);
  const entry = stored[key];
  if (!entry?.ts) return null;

  const valid = Date.now() - entry.ts < CONSTANTS.CACHE_TTL_MIN * 60 * 1000;
  if (!valid) {
    await Utils.removeStorageData(key);
    return null;
  }
  return entry.payload;
}

chrome.notifications.onClicked.addListener(id => {
  if (id === 'update-available') {
    chrome.storage.local.get('pendingUpdateUrl', ({ pendingUpdateUrl }) => {
      if (pendingUpdateUrl) chrome.tabs.create({ url: pendingUpdateUrl });
    });
    chrome.notifications.clear(id);
  }
});

async function checkUpdate(owner, repo) {
  let rsp;
  try {
    rsp = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
  } catch (e) {
    // мережева помилка (немає інтернету)
    console.warn('[Update check] network error', e.message);
    return { success: false, error: e.message };
  }

  if (rsp.status === 403 || rsp.status === 429) {
    const remaining = rsp.headers.get('x-ratelimit-remaining');
    if (rsp.status === 429 || remaining === '0') {
      const resetHeader = rsp.headers.get('x-ratelimit-reset');
      const resetAt = resetHeader
        ? Number(resetHeader) * 1000
        : Date.now() + 15 * 60 * 1000;

      console.warn('[Update check] rate limited until', new Date(resetAt).toISOString());
      return { success: false, rateLimited: true, resetAt };
    }
  }

  if (!rsp.ok) {
    console.warn(`[Update check] GitHub недоступний (HTTP ${rsp.status})`);
    return { success: false, error: `GitHub недоступний (HTTP ${rsp.status})` };
  }

  let latest;
  try {
    latest = await rsp.json();
  } catch (e) {
    console.warn(`Некоректна відповідь GitHub`);
    return { success: false, error: 'Некоректна відповідь GitHub' };
  }

  if (!latest?.tag_name) {
    console.warn(`Релізи не знайдено`);
    return { success: false, error: 'Релізи не знайдено' };
  }

  const { tag_name: latestVer, html_url: url, published_at: published, name: description } = latest;
  const cmp = Utils.semverCompare(CURRENT_VERSION, latestVer);

  if (cmp === -1) {
    await chrome.storage.local.set({ pendingUpdateUrl: url });
    chrome.notifications.create('update-available', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Доступно оновлення',
      message: `Версія ${latestVer} вийшла. Натисніть для оновлення.`
    });
  }

  return { success: true, cmp, latestVer, published, description };
}

/* ========================================
   YASNO
   ======================================== */
async function buildTableHTML(group = 'all', regionId = '3', dsoId = '301', currentDayNumber = new Date().getDate(), dayType = 'today') {
  if (Utils.isInvalidValue(regionId, dsoId)) {
    return {
      success: true,
      html: Utils.buildStatusIndicatorHTML('choose'),
      updatedOn: null,
      outageDates: []
    };
  }

  const cached = await getCached({ group, regionId, dsoId, dayType });
  if (cached) {
    return cached;
  }
  const url = `https://app.yasno.ua/api/blackout-service/public/shutdowns/regions/${regionId}/dsos/${dsoId}/planned-outages`;
  try {
    //const data = CONSTANTS.YASNO_TEST_SAMPLE
    const data = await fetch(url).then(r => r.json());
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const rows = [];
    const outageDates = [];
    const groups = group === 'all' ? Object.keys(data) : [group];

    let hasAnySlots = false;
    let isOutdated = false;
    let isEmergency = false;
    let isNoOutages = false;

    let effectiveDayType = dayType;
    let slotIndex = 0;

    const updatedOn = data[groups[0]]?.updatedOn ?? null;

    if (effectiveDayType === 'today') {
      const todayIso = data[groups[0]]?.today?.date;
      if (todayIso) {
        const scheduleDayNumber = new Date(todayIso).getDate();
        if (scheduleDayNumber !== currentDayNumber) {
          effectiveDayType = 'tomorrow';
        }
      }
    }

    for (const g of groups) {
      const schedules = data[g];
      const slots = schedules?.[effectiveDayType]?.slots || [];
      const iso = schedules?.[effectiveDayType]?.date;
      const scheduleDayNumber = new Date(iso).getDate();

      if (
        effectiveDayType === 'tomorrow' &&
        scheduleDayNumber === currentDayNumber &&
        effectiveDayType === dayType
      ) {
        continue;
      }

      isEmergency = schedules?.[effectiveDayType]?.status === 'EmergencyShutdowns';
      isNoOutages = schedules?.[effectiveDayType]?.status === 'NoOutages';
      isOutdated = schedules?.[effectiveDayType]?.status === 'WaitingForSchedule';

      if (slots.length) hasAnySlots = true;
      if (isOutdated && hasAnySlots) rows.push(Utils.buildStatusIndicatorHTML('warning'));

      for (const slot of slots) {
        rows.push(buildSlotHTML({
          turn: group === "all" ? g : null,
          start: slot.start,
          end: slot.end,
          isOutage: slot.type === 'Definite',
          isOutdated: isOutdated,
          isNow: slot.start <= nowMin && nowMin < slot.end && effectiveDayType === 'today',
          slotIndex: slotIndex,
          size: slots.length
        }));
        slotIndex++;
      }

      for (const dt of ['today', 'tomorrow']) {
        const daySchedule = schedules?.[dt];
        const dayIso = daySchedule?.date;
        if (!dayIso) continue;

        for (const daySlot of (daySchedule?.slots || [])) {
          if (daySlot.type !== 'Definite') continue;
          const slotTimestamp = slotMinutesToTimestamp(dayIso, daySlot.start);
          if (slotTimestamp > now) outageDates.push(slotTimestamp);
        }
      }
    }

    if (isEmergency) rows.push(Utils.buildStatusIndicatorHTML('danger'));
    else if (isNoOutages) rows.push(Utils.buildStatusIndicatorHTML('ok'));
    else if (!hasAnySlots) rows.push(Utils.buildStatusIndicatorHTML('info'));

    outageDates.sort((a, b) => a - b);

    const result = {
      success: true,
      html: rows.join(''),
      updatedOn,
      outageDates
    };

    await setCached({ group, regionId, dsoId, dayType }, result);
    return result;
  } catch (e) {
    console.error('[BG] Yasno: помилка', e);
    return { success: false, error: { message: e.message, url: url } };
  }
}

/* ========================================
   DTEK
   ======================================== */
async function fetchDTEKDefData(type) {
  try {
    const { city, street } = DEFAULT_PARAMS[type];
    const data = await getDtekApi(type).getHomeNum({ city, street });
    return { success: true, data: data.fact };
  } catch (error) {
    return { success: false, error: error };
  }
}

function buildHalfHourSlots(hoursData) {
  const STATUS_MAP = { yes: ['power', 'power'], no: ['outage', 'outage'], first: ['outage', 'power'], second: ['power', 'outage'] };

  return Object.entries(hoursData).flatMap(([hour, value]) => {
    const base = (Number(hour) - 1) * 60;
    const [firstHalf, secondHalf] = STATUS_MAP[value] ?? ['power', 'power'];
    return [
      { start: base, end: base + 30, status: firstHalf },
      { start: base + 30, end: base + 60, status: secondHalf }
    ];
  });
}

function mergeSlots(slots) {
  if (!slots.length) return [];
  return slots.slice(1).reduce((acc, next) => {
    const current = acc[acc.length - 1];
    if (next.status === current.status && next.start === current.end) {
      current.end = next.end;
    } else {
      acc.push({ ...next });
    }
    return acc;
  }, [{ ...slots[0] }]);
}

function renderDTEKTable(factData, group, dayType) {
  if (!factData.success) return null;
  if (!group) return null;

  const timestamp = factData.data.today;

  if (timestamp == null) return null;

  const key = dayType === 'today'
    ? timestamp
    : timestamp + 86400;

  const dayData = factData.data?.[key];

  if (!dayData) return Utils.buildStatusIndicatorHTML('ok');

  const groups = group === 'all' ? Object.keys(dayData).filter(k => k.startsWith('GPV')) : [`GPV${group}`];

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const outageDates = [];

  const html = groups.map(g => {
    if (!dayData[g]) return '';

    const slots = mergeSlots(buildHalfHourSlots(dayData[g]));

    slots.forEach(slot => {
      if (slot.status === 'outage') {
        const baseTs = dayType === 'today' ? todayTimestamp : tomorrowTimestamp;
        const slotTimestamp = Utils.minutesToDate(baseTs, slot.start);
        if (slotTimestamp > now) outageDates.push(slotTimestamp);
      }
    });

    return slots.map((slot, slotIndex) => buildSlotHTML({
      turn: group === 'all' ? g.replace("GPV", "") : null,
      start: slot.start,
      end: slot.end,
      isOutage: slot.status === 'outage',
      isOutdated: false,
      isNow: slot.start <= nowMin && nowMin < slot.end && dayType === 'today',
      slotIndex,
      size: slots.length
    })).join('');

  }).join('');

  if (dayType === 'today') {
    const tomorrowData = factData.data[tomorrowTimestamp];
    if (tomorrowData) {
      groups.forEach(g => {
        if (!tomorrowData[g]) return;
        const slots = mergeSlots(buildHalfHourSlots(tomorrowData[g]));
        slots.forEach(slot => {
          if (slot.status === 'outage') {
            outageDates.push(Utils.minutesToDate(tomorrowTimestamp, slot.start));
          }
        });
      });
    }
  }

  outageDates.sort((a, b) => a - b);
  return { html, outageDates };
}

async function buildTableHTMLDTEK(type = 'dnem', group = 'all', dayType = 'today') {
  if (Utils.isInvalidValue(type)) {
    return {
      success: true,
      html: Utils.buildStatusIndicatorHTML('choose'),
      updatedOn: null,
      outageDates: []
    };
  }

  const cached = await getCached([`dtek-${type}`, type, group, dayType]);
  if (cached) return cached;

  let rawData = await getCachedDTEKRawData(type);
  const fromCache = !!rawData;
  if (!rawData) {
    rawData = await fetchDTEKDefData(type);
    if (!rawData) return null;
  }

  if (!fromCache) {
    const key = `dtek:raw:data-${type}`;
    Utils.setStorageData({
      [key]: {
        payload: rawData,
        ts: Date.now()
      }
    });
  }

  const result = {
    success: rawData.success,
    html: renderDTEKTable(rawData, group, dayType),
    error: rawData.error,
    updatedOn: Utils.toIso(rawData.data?.update)
  };

  await setCached([`dtek-${type}`, type, group, dayType], result);
  return result;
}

/* ========================================
   АДРЕСИ (Yasno + DTEK) — міста, вулиці, будинки
   ======================================== */

// Тільки Yasno: DTEK не має окремого ендпоінта для списку міст.
// params: { regionId, dsoId, query }
async function getCities(params) {
  try {
    const { regionId, dsoId, query } = params;
    const api = new YasnoAddressApi({ regionId, dsoId });
    const data = await api.getCities(query);
    return { success: true, data };
  } catch (error) {
    console.error('[Address] помилка getCities:', error);
    return { success: false, error };
  }
}

// type: 'yasno' | 'dtek'
// Yasno params: { regionId, dsoId, cityId, query }
// DTEK params:  { city (лише для dnem), query — не використовується }
async function getStreets(type, params) {
  try {
    if (isYasnoType(type)) {
      const { regionId, dsoId, cityId, query } = params;
      const api = new YasnoAddressApi({ regionId, dsoId });
      const data = await api.getStreets(cityId, query);
      return { success: true, data };
    }

    const api = getDtekApi(type);
    const { query } = params;
    const data = await api.getStreets({ city: query });
    return { success: true, data };
  } catch (error) {
    console.error('[Address] помилка getStreets:', error);
    return { success: false, error };
  }
}

// type: 'yasno' | 'dnem' | 'kem'
// Yasno params: { regionId, dsoId, cityId, streetId, query }
// DTEK params:  { city (лише для dnem), street }
async function getHouses(type, params) {
  try {
    if (isYasnoType(type)) {
      const { regionId, dsoId, cityId, streetId, query } = params;
      const api = new YasnoAddressApi({ regionId, dsoId });
      const data = await api.getHouses(cityId, streetId, query);
      return { success: true, data };
    }

    const api = getDtekApi(type);
    const data = await api.getHomeNum(params); // { city, street }
    return { success: true, data };
  } catch (error) {
    console.error('[Address] помилка getHouseNumbers:', error);
    return { success: false, error };
  }
}

// type: 'yasno' | 'dnem' | 'kem'
// Yasno params: { regionId, dsoId, cityId, streetId, houseId }
// DTEK params:  { city (лише для dnem), street, house }
async function getHouseData(type, params) {
  try {
    if (isYasnoType(type)) {
      const { regionId, dsoId, cityId, streetId, houseId } = params;
      const api = new YasnoAddressApi({ regionId, dsoId });
      const data = await api.getGroup(cityId, streetId, houseId);
      return { success: true, data };
    }

    const api = getDtekApi(type);
    const { house } = params;
    const response = await api.getHomeNum(params);

    const data = response.data?.[house] || response.data?.data?.[house] || {};
    const updateTimestamp = response.updateTimestamp;
    return { success: true, data, updateTimestamp };
  } catch (error) {
    console.error('[DTEK/Yasno] помилка getHouseData:', error);
    return { success: false, error };
  }
}

/* ---------- messaging ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    //Перевірка оновлень розширення
    checkUpdate: () => checkUpdate(msg.owner, msg.repo)
      .then(result => sendResponse({ result }))
      .catch(error => sendResponse({ result: { success: false, error: error.message } })),

    //Фетч даних та побудовка таблиці з відключеннями для Ясно
    fetchYasno: () => buildTableHTML(msg.group, msg.regionId, msg.dsoId, msg.currentDayNumber, msg.dayType)
      .then(async (result) => {
        if (result.success && result.outageDates) {
          await NotificationScheduler.saveOutageSchedule(result.outageDates);
        }
        sendResponse(result);
      }),

    //Фетч даних та побудовка таблиці з відключеннями для ДТЕК
    fetchDTEK: () => buildTableHTMLDTEK(msg.type, msg.group, msg.dayType)
      .then(async (result) => {
        if (result.success && result.outageDates) {
          await NotificationScheduler.saveOutageSchedule(result.outageDates);
        }
        sendResponse(result);
      }),

    // msg.params: { regionId, dsoId, query }
    fetchCity: () => getCities(msg.params).then(sendResponse),
    // msg.type: 'yasno' | 'dnem' | 'kem'
    fetchStreet: () => getStreets(msg.type, msg.params).then(sendResponse),
    // msg.type: 'yasno' | 'dnem' | 'kem'
    fetchHouses: () => getHouses(msg.type, msg.params).then(sendResponse),
    // msg.type: 'dnem' | 'kem' (Yasno не підтримується, див. getHouseData)
    fetchHouseData: () => getHouseData(msg.type, msg.params).then(sendResponse),

    //Очищення кешу розширення
    clearTableCache: () => clearTableCache().then((result) => sendResponse(result)),
    clearAllCache: () => clearAllCache().then((result) => sendResponse(result))
  };

  const handler = handlers[msg.action];
  if (handler) { handler(); return true; }
});

async function clearTableCache() {
  try {

    const all = await chrome.storage.local.get();
    const toRemove = Object.keys(all).filter(k => k.startsWith(CONSTANTS.CACHE_KEY_PREFIX));
    if (toRemove.length) await chrome.storage.local.remove(toRemove);
    return { success: true, removed: toRemove.length };
  }
  catch (e) {
    return { success: false, error: e };
  }
}

async function clearAllCache() {
  try {
    const all = await chrome.storage.local.get();
    const removedCount = Object.keys(all).length;

    await chrome.storage.local.clear();

    return { success: true, removed: removedCount };
  }
  catch (e) {
    return { success: false, error: e.message };
  }
}