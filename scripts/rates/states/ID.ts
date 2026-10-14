import { flatState } from "./_simple";
/** Idaho STC: 6% statewide (resort-city taxes do not reach remote sellers) */
export const build = async () => flatState("ID", 0.06, "Idaho STC: 6% statewide (resort-city taxes do not reach remote sellers)");
