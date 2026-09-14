import { Utils } from '../utils/utils.js';
export const MODE_STRATEGIES = {
  yasno: {
    action: 'fetchYasno',
    buildPayload: ({ group, regionId, dsoId, currentDayNumber, dayType }) => ({
      action: 'fetchYasno',
      group,
      regionId,
      dsoId,
      currentDayNumber,
      dayType
    }),
  },

  dtek: {
    action: 'fetchDTEK',
    buildPayload: ({ group, dsoId, dayType }) => ({
      action: 'fetchDTEK',
      type: Utils.DSOID_TO_DTEK_TYPE[dsoId],
      group,
      dayType,
    }),
  }
};