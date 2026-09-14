/**
 * Клас для роботи з Yasno API (пошук міст, вулиць, будинків для перевірки графіків відключень).
 *
 * Приклад використання:
 *
 *   const api = new YasnoAddressApi({ regionId: 3, dsoId: 301 });
 *
 *   const cities = await api.getCities('л');
 *   const streets = await api.getStreets(4, 'п');
 *   const houses = await api.getHouses(4, 332, '');
 *
 *   // Якщо потрібно змінити регіон чи ОСР пізніше:
 *   api.regionId = 5;
 *   api.dsoId = 401;
 */

export class YasnoAddressApi {
  baseUrl = 'https://app.yasno.ua/api/blackout-service/public/shutdowns/addresses/v2';

  constructor({ regionId, dsoId }) {
    this.regionId = regionId;
    this.dsoId = dsoId;
  }

  /** Побудувати URL з довільним набором query-параметрів. Параметри зі значенням
   * null/undefined пропускаються — не потрапляють у результуючий URL. */
  buildUrl(path, params) {
    const url = new URL(`${this.baseUrl}/${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  /** Пошук міст: /cities?regionId=&query=&dsoId= */
  async getCities(query) {
    const url = this.buildUrl('cities', {
      regionId: this.regionId,
      query,
      dsoId: this.dsoId,
    });
    return this.request(url);
  }

  /** Пошук вулиць: /streets?regionId=&cityId=&query=&dsoId= */
  async getStreets(cityId, query) {
    const url = this.buildUrl('streets', {
      regionId: this.regionId,
      cityId,
      query,
      dsoId: this.dsoId,
    });
    return this.request(url);
  }

  /** Пошук будинків: /houses?regionId=&cityId=&streetId=&query=&dsoId= */
  async getHouses(cityId, streetId, query = '') {
    const url = this.buildUrl('houses', {
      regionId: this.regionId,
      cityId,
      streetId,
      query,
      dsoId: this.dsoId,
    });
    return this.request(url);
  }

  /** Отримати групу та підгрупу для будинку: /group?regionId=&cityId=&streetId=&houseId=&dsoId= */
  async getGroup(cityId, streetId, houseId) {
    const url = this.buildUrl('group', {
      regionId: this.regionId,
      cityId,
      streetId,
      houseId,
      dsoId: this.dsoId,
    });
    return this.request(url);
  }

  /** Внутрішній виконавець запиту. */
  async request(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Yasno API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}