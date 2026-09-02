export type PortalAccess = {
  id: string;
  name: string;
  description: string;
  href: string;
  eyebrow: string;
  enabled: boolean;
};

export const portalAccesses: PortalAccess[] = [
  {
    id: "it",
    name: "IT",
    description: "Aplicaciones y soluciones web internas.",
    href: "/it",
    eyebrow: "Tecnología",
    enabled: true,
  },
  {
    id: "wms",
    name: "WMS",
    description: "Operaciones y gestión de almacenes.",
    href: "/areas/wms",
    eyebrow: "Operaciones",
    enabled: false,
  },
  {
    id: "auditoria",
    name: "Auditoría",
    description: "Documentación, controles y seguimiento.",
    href: "/areas/auditoria",
    eyebrow: "Control",
    enabled: false,
  },
  {
    id: "ventas",
    name: "Ventas",
    description: "Recursos y herramientas comerciales.",
    href: "/areas/ventas",
    eyebrow: "Comercial",
    enabled: false,
  },
  {
    id: "compras",
    name: "Compras",
    description: "Proveedores y documentación de compras.",
    href: "/areas/compras",
    eyebrow: "Abastecimiento",
    enabled: false,
  },
  {
    id: "comex",
    name: "COMEX",
    description: "Operaciones de comercio exterior.",
    href: "/areas/comex",
    eyebrow: "Internacional",
    enabled: false,
  },
  {
    id: "capital-humano",
    name: "Capital Humano",
    description: "Información y recursos para el equipo.",
    href: "/areas/capital-humano",
    eyebrow: "Personas",
    enabled: false,
  },
];

export const defaultHomeAccessIds = ["it", "wms", "auditoria", "ventas"];
