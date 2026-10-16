// Usable floor/water/table areas, measured against the shipped 16:9 artwork.
// x/y bound visible feet, not the transparent sprite cell. People never inherit
// a pencil's tabletop merely because both use the classroom background.
import { kategoriJenis, profilJenis } from './tata.js';

const area = (x, y, skala = 1) => ({ x, y, skala, batasiX: true });
const FLOOR = area([.1, .85], [.65, .91]);
export const PERMUKAAN = {
  farm: { floor: area([.12,.76],[.65,.89]) },
  jungle: { floor: area([.18,.76],[.67,.87]) },
  underwater: { water: area([.14,.82],[.4,.84]) },
  woodland: { floor: area([.12,.75],[.7,.9]), branch: area([.65,.84],[.4,.49]) },
  'flower-garden': { floor: area([.12,.68],[.68,.88],1.12) },
  homeyard: { floor: area([.15,.78],[.67,.9]) },
  community: { floor: area([.14,.82],[.65,.89]) },
  'fruit-market': { floor: area([.1,.58],[.5,.58],.8), table: area([.12,.88],[.72,.82]) },
  'vegetable-garden': { floor: area([.13,.62],[.5,.58],.8), table: area([.12,.88],[.72,.83]) },
  kitchen: { floor: area([.08,.31],[.72,.93],1.3), table: area([.55,.9],[.66,.82]) },
  classroom: { floor: area([.09,.32],[.72,.93],1.35), table: area([.57,.9],[.68,.83]) },
  'living-room': { floor: area([.12,.8],[.67,.91],1.15) },
  'city-road': { floor: area([.12,.84],[.63,.87]), road: area([.12,.85],[.67,.89]) },
  nature: { floor: area([.12,.84],[.65,.9]) },
  'dressing-room': { floor: area([.16,.8],[.69,.91]) },
  playroom: { floor: area([.14,.84],[.66,.91]) },
  savanna: { floor: area([.12,.81],[.67,.9]) },
  river: { floor: area([.12,.39],[.68,.87]), water: area([.58,.85],[.57,.78]) },
  'deep-ocean': { water: area([.12,.83],[.35,.83]) },
  beach: { floor: area([.1,.65],[.7,.89]), water: area([.4,.77],[.4,.56]) },
  wetland: { floor: area([.13,.8],[.86,.94],.94), water: area([.2,.81],[.53,.73]) },
  polar: { floor: area([.16,.79],[.68,.9]) },
  'night-forest': { floor: area([.17,.76],[.74,.91]), air: area([.14,.6],[.24,.5]) },
  'rice-fields': { floor: area([.16,.78],[.71,.89]) },
  clinic: { floor: area([.12,.71],[.66,.92]) },
  harbor: { floor: area([.26,.78],[.79,.91]), water: area([.14,.62],[.49,.65]) },
  airport: { floor: area([.14,.81],[.68,.9]) },
  railway: { floor: area([.51,.87],[.5,.62],.78), rail: area([.13,.85],[.69,.77]) },
  space: { air: area([.15,.78],[.38,.76]) },
  playground: { floor: area([.13,.72],[.69,.9]) },
  'open-sky': { floor: area([.14,.81],[.87,.95],.9), air: area([.14,.8],[.28,.65]) },
  mountains: { floor: area([.16,.79],[.69,.9]) },
};

export function areaUntuk(objek, background, matched = {}) {
  const zones = PERMUKAAN[background] || {};
  const type = kategoriJenis(objek.jenis);
  const profile = profilJenis(objek.jenis);
  const requested = matched.permukaan;
  if (objek.aksi === 'terbang') return zones.air || area([.13,.81],[.27,.62]);
  if (objek.aksi === 'berenang' || requested === 'water' && type === 'hewan') return zones.water || zones.floor || FLOOR;
  if (type === 'manusia' || type === 'hewan') return zones.floor || zones.water || zones.air || FLOOR;
  if (profile === 'kendaraan') return zones.road || zones.rail || zones.floor || FLOOR;
  if (profile === 'benda-kecil' || profile === 'perabot' && requested === 'table') return zones.table || zones.floor || FLOOR;
  return zones.floor || zones.water || zones.air || FLOOR;
}
