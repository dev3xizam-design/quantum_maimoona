import { flatState } from "./_simple";
/** MA DOR: 6.25% statewide, no local sales tax on goods */
export const build = async () => flatState("MA", 0.0625, "MA DOR: 6.25% statewide, no local sales tax on goods");
