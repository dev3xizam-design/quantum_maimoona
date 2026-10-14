import { flatState } from "./_simple";
/** CT DRS: 6.35% statewide, no local sales taxes */
export const build = async () => flatState("CT", 0.0635, "CT DRS: 6.35% statewide, no local sales taxes");
