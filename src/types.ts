export interface Drank {
  id: string;
  naam: string;
  minimumVoorraad: number;
  locatieId: string;
  categorie: string;
  eenheid: string;
}

export interface Telling {
  drankId: string;
  aantal: number;
  ronde: number;
  locatieId: string;
}

export interface DrankTotaal {
  drankId: string;
  naam: string;
  minimumVoorraad: number;
  eenheid: string;
  totaalAantal: number;
  teBestellen: number;
  categorie: string;
}

export interface Locatie {
  id: string;
  naam: string;
  volgorde: number;
} 
