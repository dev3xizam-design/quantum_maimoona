import { flatState } from "./_simple";
/** Alaska: no state sales tax (local ARSSTC remote-seller taxes not modelled; Avalara charged 0 on this store's AK orders) */
export const build = async () => flatState("AK", 0, "Alaska: no state sales tax (local ARSSTC remote-seller taxes not modelled; Avalara charged 0 on this store's AK orders)");
