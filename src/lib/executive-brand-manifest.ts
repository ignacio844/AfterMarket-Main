export type ExecutiveBrandDefinition = {
  name: string;
  matchTerms: readonly string[];
  logo: string;
};

export const executiveBrandManifest = [
  { name: "VERKEHR", matchTerms: ["VERKEHR"], logo: "/brands/verkehr.png" },
  { name: "HUTCHINSON", matchTerms: ["HUTCHINSON"], logo: "/brands/hutchinson.png" },
  { name: "DIVAIO", matchTerms: ["DIVAIO"], logo: "/brands/divaio.png" },
  { name: "DZE", matchTerms: ["DZE"], logo: "/brands/dze.png" },
  { name: "IRON", matchTerms: ["IRON"], logo: "/brands/iron.png" },
  { name: "KOBLA", matchTerms: ["KOBLA"], logo: "/brands/kobla.png" },
  { name: "LUX LED", matchTerms: ["LUX LED"], logo: "/brands/lux-led.png" },
  { name: "MAVERICK", matchTerms: ["MAVERICK"], logo: "/brands/maverick.png" },
  { name: "RGU PRO", matchTerms: ["RGU PRO"], logo: "/brands/rgu-pro.png" },
  { name: "TOP SAFE", matchTerms: ["TOP SAFE"], logo: "/brands/top-safe.png" },
  { name: "FERRAZZI", matchTerms: ["FERRAZZI"], logo: "/brands/ferrazzi.png" },
  { name: "PHILIPS", matchTerms: ["PHILIPS"], logo: "/brands/philips.png" },
  { name: "MIKIMOTO", matchTerms: ["MIKIMOTO"], logo: "/brands/mikimoto.png" },
  { name: "GV", matchTerms: ["GV"], logo: "/brands/gv.png" },
  { name: "GENOUD", matchTerms: ["GENOUD"], logo: "/brands/genoud.png" },
  { name: "MIRAGE", matchTerms: ["MIRAGE"], logo: "/brands/mirage.png" },
  { name: "NQD", matchTerms: ["NQD"], logo: "/brands/nqd.png" },
  { name: "ORO", matchTerms: ["ORO"], logo: "/brands/oro.png" },
  { name: "TOXIC SHINE", matchTerms: ["TOXIC SHINE"], logo: "/brands/toxic-shine.png" },
  { name: "WAGNER", matchTerms: ["WAGNER"], logo: "/brands/wagner.png" },
  { name: "DAEMA", matchTerms: ["DAEMA"], logo: "/brands/daema.png" },
  { name: "EKTION", matchTerms: ["EKTION"], logo: "/brands/ektion-v3.png" },
  { name: "KOBO", matchTerms: ["KOBO"], logo: "/brands/kobo.png" },
  { name: "KUBE", matchTerms: ["KUBE"], logo: "/brands/kube.png" },
  { name: "OREGON", matchTerms: ["OREGON"], logo: "/brands/oregon-v2.png" },
  { name: "ORLAN ROBER", matchTerms: ["ORLAN ROBER"], logo: "/brands/orlan-rober.png" },
  { name: "BYC", matchTerms: ["BYC"], logo: "/brands/byc.png" },
  { name: "CROCOS ACCESORIOS", matchTerms: ["CROCOS"], logo: "/brands/crocos-accesorios.png" },
  { name: "MOTOLITE LAMPARAS", matchTerms: ["MOTOLITE"], logo: "/brands/motolite-lamparas.png" },
] as const satisfies readonly ExecutiveBrandDefinition[];
