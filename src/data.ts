import { Drank, Locatie } from './types';

export const locaties: Locatie[] = [
  {
    id: '1',
    naam: 'Kast',
    volgorde: 1
  },
  {
    id: '2',
    naam: 'Bar',
    volgorde: 2
  },
  {
    id: '3',
    naam: 'Koeling',
    volgorde: 3
  }
];

export const dranken: Drank[] = [
  {
    id: 'cola',
    naam: 'Cola',
    minimumVoorraad: 24,
    locatieId: '1',
    categorie: 'FRISDRANK',
    eenheid: 'stuks'
  },
  {
    id: 'fanta',
    naam: 'Fanta',
    minimumVoorraad: 12,
    locatieId: '1',
    categorie: 'FRISDRANK',
    eenheid: 'stuks'
  },
  {
    id: 'spa-rood',
    naam: 'Spa Rood',
    minimumVoorraad: 12,
    locatieId: '3',
    categorie: 'WATER',
    eenheid: 'stuks'
  },
  {
    id: 'heineken',
    naam: 'Heineken',
    minimumVoorraad: 48,
    locatieId: '3',
    categorie: 'BIER',
    eenheid: 'stuks'
  },
  {
    id: 'wijn-rood',
    naam: 'Rode Wijn',
    minimumVoorraad: 6,
    locatieId: '2',
    categorie: 'WIJN',
    eenheid: 'flessen'
  }
]; 