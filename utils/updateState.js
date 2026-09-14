export const UPDATE_STATE_META = {
  1:    { css: 'state-neutral', text: () => 'Використовується новіша версія' },
  0:    { css: 'state-success', text: () => 'Використовується остання версія' },
  '-1': { css: 'state-update',  text: (v) => `Знайдено оновлення: ${v}` },
};

export function getUpdateStateMeta(cmp, latestVer) {
  const meta = UPDATE_STATE_META[String(cmp)];
  if (!meta) {
    return { css: 'state-error', text: 'Стан оновлення невідомий' };
  }
  return { css: meta.css, text: meta.text(latestVer) };
}