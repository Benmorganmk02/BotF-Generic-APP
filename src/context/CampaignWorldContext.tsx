import { createContext, useContext } from 'react';

/** The type (world) of the campaign a sheet is opened in, if any. A character's own world comes first; this fills in what
 * the character's world does not decide (for example which currency to carry). */
export const CampaignWorldContext = createContext<string | undefined>(undefined);
export const useCampaignWorld = () => useContext(CampaignWorldContext);
