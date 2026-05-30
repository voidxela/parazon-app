/** Warframe (the suit) type definitions. */

export type Polarity =
  | "Madurai"
  | "Vazarin"
  | "Naramon"
  | "Zenurik"
  | "Unairu"
  | "Penjaga"
  | "Umbra";

export interface Warframe {
  readonly uniqueName: string;
  readonly name: string;
  readonly health: number;
  readonly shield: number;
  readonly armor: number;
  readonly energy: number;
  readonly sprintSpeed: number;
  readonly masteryReq: number;
  readonly polarities: readonly Polarity[];
  readonly auraPolarity: Polarity;
  readonly exilusPolarity: Polarity | null;
  readonly isPrime: boolean;
  readonly isUmbra: boolean;
}
