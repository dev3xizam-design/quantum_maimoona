import { flatState } from "./_simple";
/** MD Comptroller: 6% statewide, no local sales taxes */
export const build = async () => flatState("MD", 0.06, "MD Comptroller: 6% statewide, no local sales taxes");
