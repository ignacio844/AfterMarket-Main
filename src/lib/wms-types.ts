export const WMS_RESOURCE_TYPES = ["Carpeta", "Documento", "Presentación", "Planilla"] as const;

export type WmsResourceType = (typeof WMS_RESOURCE_TYPES)[number];

export type WmsResource = {
  id: string;
  slug: string;
  name: string;
  href: string;
  type: WmsResourceType;
  isPrimary: boolean;
  position: number;
};

export type WmsModule = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  position: number;
  resources: WmsResource[];
};
