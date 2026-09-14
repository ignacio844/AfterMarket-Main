// Read-only port of obtenerTransferenciasStockPortal().
// This module only calculates suggested stock transfers from GESTION_COMPRAS_ACTIVA.
import {
  columns,
  dashboardNumber,
  formatDate,
  text,
  value,
  type SheetRows,
} from "@/lib/compras-dashboard";

export const TRANSFER_DIRECTIONS = ["ESCOBAR → WARNES", "WARNES → ESCOBAR"] as const;
export type TransferDirection = (typeof TRANSFER_DIRECTIONS)[number];

export type TransferenciaRegistro = {
  sku: string;
  descripcion: string;
  marca: string;
  stockWarnes: number;
  stockEscobar: number;
  stockTotal: number;
  porcentajeWarnes: number;
  porcentajeEscobar: number;
  direccion: TransferDirection;
  cantidadTransferir: number;
  warnesFinal: number;
  escobarFinal: number;
  porcentajeWarnesFinal: number;
  porcentajeEscobarFinal: number;
  aproximado: boolean;
};

export type ComprasTransferencias = {
  actualizado: string;
  registros: TransferenciaRegistro[];
  marcas: string[];
  resumen: {
    skuTransferir: number;
    unidadesEscobarWarnes: number;
    unidadesWarnesEscobar: number;
    dentroTolerancia: number;
    sinStock: number;
  };
};

export type TransferenciasFilters = {
  texto: string;
  direccion: "" | TransferDirection;
  marca: string;
};

export type TransferenciasSortKey =
  | "stockWarnes"
  | "stockEscobar"
  | "stockTotal"
  | "porcentajeWarnes"
  | "porcentajeEscobar"
  | "cantidadTransferir"
  | "warnesFinal"
  | "escobarFinal"
  | "porcentajeWarnesFinal"
  | "porcentajeEscobarFinal";

function objetivoWarnes(stockTotal: number) {
  const total = Math.max(0, Math.round(stockTotal || 0));
  if (total <= 0) return 0;

  const teorico = total * 0.1;
  const candidatos = [
    Math.max(0, Math.floor(teorico)),
    Math.min(total, Math.ceil(teorico)),
  ];

  let mejor = candidatos[0];
  let mejorDesvio = Math.abs(mejor / total - 0.1);

  for (const cantidad of candidatos) {
    const desvio = Math.abs(cantidad / total - 0.1);
    if (desvio < mejorDesvio) {
      mejor = cantidad;
      mejorDesvio = desvio;
    }
  }

  return mejor;
}

export function calculateComprasTransferencias(
  sheets: { gestion: SheetRows },
  now = new Date(),
): ComprasTransferencias {
  const rows = sheets.gestion;
  if (rows.length === 0) {
    return {
      actualizado: formatDate(now),
      registros: [],
      marcas: [],
      resumen: {
        skuTransferir: 0,
        unidadesEscobarWarnes: 0,
        unidadesWarnesEscobar: 0,
        dentroTolerancia: 0,
        sinStock: 0,
      },
    };
  }

  const column = columns(rows[0]);
  const cSku = column("SKU");
  const cDescripcion = column("DESCRIPCION");
  const cMarca = column("MARCA");
  const cWarnes = column("STOCK_WARNES");
  const cEscobar = column("STOCK_ESCOBAR");

  if (cSku < 0 || cWarnes < 0 || cEscobar < 0) {
    throw new Error("GESTION_COMPRAS_ACTIVA debe contener SKU, STOCK_WARNES y STOCK_ESCOBAR.");
  }

  const registros: TransferenciaRegistro[] = [];
  const marcas = new Set<string>();
  let dentroTolerancia = 0;
  let sinStock = 0;
  let unidadesEscobarWarnes = 0;
  let unidadesWarnesEscobar = 0;

  for (const row of rows.slice(1)) {
    const sku = text(value(row, cSku));
    if (!sku) continue;

    const stockWarnes = Math.max(0, dashboardNumber(value(row, cWarnes)));
    const stockEscobar = Math.max(0, dashboardNumber(value(row, cEscobar)));
    const stockTotal = stockWarnes + stockEscobar;

    if (stockTotal <= 0) {
      sinStock++;
      continue;
    }

    const porcentajeWarnes = stockWarnes / stockTotal;
    const porcentajeEscobar = stockEscobar / stockTotal;

    if (porcentajeWarnes >= 0.07 && porcentajeWarnes <= 0.13) {
      dentroTolerancia++;
      continue;
    }

    const warnesFinal = objetivoWarnes(stockTotal);
    const cantidadTransferir = Math.abs(warnesFinal - stockWarnes);
    if (cantidadTransferir <= 0) continue;

    let direccion: TransferDirection;
    if (warnesFinal > stockWarnes) {
      direccion = "ESCOBAR → WARNES";
      unidadesEscobarWarnes += cantidadTransferir;
    } else {
      direccion = "WARNES → ESCOBAR";
      unidadesWarnesEscobar += cantidadTransferir;
    }

    const marca = cMarca >= 0 ? text(value(row, cMarca)) || "SIN MARCA" : "SIN MARCA";
    marcas.add(marca);

    const porcentajeWarnesFinal = warnesFinal / stockTotal;

    registros.push({
      sku,
      descripcion: cDescripcion >= 0 ? text(value(row, cDescripcion)) : "",
      marca,
      stockWarnes,
      stockEscobar,
      stockTotal,
      porcentajeWarnes,
      porcentajeEscobar,
      direccion,
      cantidadTransferir,
      warnesFinal,
      escobarFinal: stockTotal - warnesFinal,
      porcentajeWarnesFinal,
      porcentajeEscobarFinal: 1 - porcentajeWarnesFinal,
      aproximado: !(porcentajeWarnesFinal >= 0.07 && porcentajeWarnesFinal <= 0.13),
    });
  }

  registros.sort((a, b) => {
    if (b.cantidadTransferir !== a.cantidadTransferir) {
      return b.cantidadTransferir - a.cantidadTransferir;
    }
    return a.sku.localeCompare(b.sku, "es");
  });

  return {
    actualizado: formatDate(now),
    registros,
    marcas: Array.from(marcas).sort((a, b) => a.localeCompare(b, "es")),
    resumen: {
      skuTransferir: registros.length,
      unidadesEscobarWarnes,
      unidadesWarnesEscobar,
      dentroTolerancia,
      sinStock,
    },
  };
}

export function filterTransferencias(
  registros: TransferenciaRegistro[],
  filters: TransferenciasFilters,
) {
  const search = filters.texto.trim().toUpperCase();

  return registros.filter((registro) => {
    if (filters.direccion && registro.direccion !== filters.direccion) return false;
    if (filters.marca && registro.marca !== filters.marca) return false;
    if (!search) return true;

    return `${registro.sku} ${registro.descripcion} ${registro.marca}`
      .toUpperCase()
      .includes(search);
  });
}
