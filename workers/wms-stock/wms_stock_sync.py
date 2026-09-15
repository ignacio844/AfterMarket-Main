from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd
import requests
from dotenv import load_dotenv

TZ = ZoneInfo("America/Argentina/Buenos_Aires")

SOURCE_SYSTEM = "WMS"
DEPOSITO = "WARNES"
WMS_DEPOSITO_VALUE = "2"

DEFAULT_MIN_SKUS = 4000
DEFAULT_MAX_SKU_DELTA = 0.25
DEFAULT_MAX_STOCK_DELTA = 0.30


def log(message: str) -> None:
    print(message, flush=True)


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Falta configurar {name} en el archivo .env")
    return value


def normalizar_numero(value: Any) -> float:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    raw = str(value).strip().replace("\xa0", "").replace(" ", "")
    if not raw:
        return 0.0

    if "," in raw and "." in raw:
        if raw.rfind(",") > raw.rfind("."):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    elif "," in raw:
        parts = raw.split(",")
        if len(parts[-1]) in (1, 2):
            raw = raw.replace(".", "").replace(",", ".")
        else:
            raw = raw.replace(",", "")
    else:
        try:
            return float(raw)
        except ValueError:
            raw = raw.replace(".", "")

    try:
        return float(raw)
    except ValueError:
        return 0.0


@dataclass
class WmsParseResult:
    items: pd.DataFrame
    source_rows: int
    unique_skus: int
    duplicate_skus: int
    total_stock: float


def leer_reporte_wms(ruta: Path) -> WmsParseResult:
    if not ruta.exists():
        raise FileNotFoundError(f"No existe el archivo: {ruta}")

    try:
        tablas = pd.read_html(str(ruta), encoding="utf-8")
    except Exception as exc:
        raise RuntimeError(
            "No pude leer el archivo WMS. Debe ser el XLS generado por "
            "'Stock de Contenedores por Artículo'."
        ) from exc

    if not tablas:
        raise RuntimeError("El archivo WMS no contiene tablas.")

    raw = max(tablas, key=len)

    primeras = " ".join(
        str(x) for x in raw.head(10).fillna("").astype(str).to_numpy().ravel()
    ).upper()

    if "CD WARNES" not in primeras:
        raise RuntimeError(
            "El reporte descargado no parece corresponder a CD WARNES. "
            "No se procesará."
        )

    header_idx = None
    header = None

    for idx, row in raw.head(25).iterrows():
        values = [str(v).strip() for v in row.tolist()]
        if "Artículo" in values and "Unidades Disponibles" in values:
            header_idx = idx
            header = values
            break

    if header_idx is None or header is None:
        raise RuntimeError(
            "No encontré las columnas 'Artículo' y 'Unidades Disponibles'."
        )

    articulo_cols = [i for i, value in enumerate(header) if value == "Artículo"]
    unidades_cols = [
        i for i, value in enumerate(header) if value == "Unidades Disponibles"
    ]

    if not articulo_cols or not unidades_cols:
        raise RuntimeError("No se pudieron identificar las columnas necesarias.")

    sku_col = articulo_cols[-1]
    stock_col = unidades_cols[0]

    data = raw.iloc[header_idx + 1 :].copy()
    source_rows = len(data)

    sku = (
        data.iloc[:, sku_col]
        .fillna("")
        .astype(str)
        .str.strip()
        .str.replace(r"\s+", "", regex=True)
        .str.upper()
    )
    stock = data.iloc[:, stock_col].map(normalizar_numero)

    df = pd.DataFrame({"SKU": sku, "STOCK": stock})

    excluir = {
        "",
        "NAN",
        "(ENBLANCO)",
        "(EN BLANCO)",
        "TOTALGENERAL",
        "TOTAL GENERAL",
        "TOTAL",
    }
    normalized_filter = (
        df["SKU"].astype(str).str.upper().str.replace(r"\s+", "", regex=True)
    )
    df = df[~normalized_filter.isin(excluir)].copy()

    if df.empty:
        raise RuntimeError("El reporte quedó sin SKU válidos luego de procesarlo.")

    counts = df.groupby("SKU").size()
    duplicate_skus = int((counts > 1).sum())

    grouped = (
        df.groupby("SKU", as_index=False, sort=True)["STOCK"]
        .sum()
        .sort_values("SKU", key=lambda s: s.str.casefold())
        .reset_index(drop=True)
    )

    if ((grouped["STOCK"] % 1) == 0).all():
        grouped["STOCK"] = grouped["STOCK"].astype(int)

    return WmsParseResult(
        items=grouped,
        source_rows=source_rows,
        unique_skus=len(grouped),
        duplicate_skus=duplicate_skus,
        total_stock=float(
            pd.to_numeric(grouped["STOCK"], errors="coerce").fillna(0).sum()
        ),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


class SupabaseRest:
    def __init__(self) -> None:
        self.url = env_required("SUPABASE_URL").rstrip("/")
        self.key = env_required("SUPABASE_SECRET_KEY")
        self.schema = (
            os.getenv("SUPABASE_SCHEMA", "portal_aftermarket").strip()
            or "portal_aftermarket"
        )

        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Accept-Profile": self.schema,
                "Content-Profile": self.schema,
                "Content-Type": "application/json",
            }
        )

    def _url(self, table: str) -> str:
        return f"{self.url}/rest/v1/{table}"

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        response = self.session.get(self._url(table), params=params, timeout=60)
        if not response.ok:
            raise RuntimeError(
                f"Supabase SELECT {table} falló: "
                f"{response.status_code} {response.text[:500]}"
            )
        return response.json()

    def insert(
        self,
        table: str,
        rows: list[dict[str, Any]] | dict[str, Any],
        *,
        return_representation: bool = False,
    ) -> list[dict[str, Any]]:
        headers = {
            "Prefer": (
                "return=representation"
                if return_representation
                else "return=minimal"
            )
        }
        response = self.session.post(
            self._url(table),
            headers=headers,
            data=json.dumps(rows, ensure_ascii=False),
            timeout=120,
        )
        if not response.ok:
            raise RuntimeError(
                f"Supabase INSERT {table} falló: "
                f"{response.status_code} {response.text[:700]}"
            )
        if not return_representation:
            return []
        return response.json()

    def update(
        self,
        table: str,
        filters: dict[str, str],
        values: dict[str, Any],
    ) -> None:
        response = self.session.patch(
            self._url(table),
            params=filters,
            headers={"Prefer": "return=minimal"},
            data=json.dumps(values, ensure_ascii=False),
            timeout=60,
        )
        if not response.ok:
            raise RuntimeError(
                f"Supabase UPDATE {table} falló: "
                f"{response.status_code} {response.text[:700]}"
            )


def validar_variacion(
    nuevo: WmsParseResult,
    supabase: SupabaseRest,
    force: bool,
) -> None:
    min_skus = int(os.getenv("WMS_MIN_SKUS", str(DEFAULT_MIN_SKUS)))
    max_sku_delta = float(
        os.getenv("WMS_MAX_SKU_DELTA", str(DEFAULT_MAX_SKU_DELTA))
    )
    max_stock_delta = float(
        os.getenv("WMS_MAX_STOCK_DELTA", str(DEFAULT_MAX_STOCK_DELTA))
    )

    errores: list[str] = []

    if nuevo.unique_skus < min_skus:
        errores.append(
            f"solo se detectaron {nuevo.unique_skus} SKU "
            f"(mínimo de seguridad: {min_skus})"
        )

    anteriores = supabase.select(
        "compras_stock_imports",
        {
            "select": "id,metadata,filas_validas,fecha_importacion",
            "source_system": f"eq.{SOURCE_SYSTEM}",
            "deposito": f"eq.{DEPOSITO}",
            "estado": "eq.VALIDADO",
            "order": "fecha_importacion.desc,id.desc",
            "limit": "1",
        },
    )

    if anteriores:
        previo = anteriores[0]
        metadata = previo.get("metadata") or {}
        prev_skus = int(
            metadata.get("uniqueSkus") or previo.get("filas_validas") or 0
        )
        prev_stock = float(metadata.get("totalStock") or 0)

        if prev_skus > 0:
            delta = abs(nuevo.unique_skus - prev_skus) / prev_skus
            if delta > max_sku_delta:
                errores.append(f"la cantidad de SKU varió {delta:.1%}")

        if prev_stock > 0:
            delta = abs(nuevo.total_stock - prev_stock) / prev_stock
            if delta > max_stock_delta:
                errores.append(f"el stock total varió {delta:.1%}")

    if errores and not force:
        raise RuntimeError(
            "CONTROL DE SEGURIDAD: "
            + "; ".join(errores)
            + ". Si verificaste que la variación es correcta, repetí con --force."
        )


def guardar_snapshot_supabase(
    parsed: WmsParseResult,
    file_path: Path,
    force: bool,
) -> int:
    supabase = SupabaseRest()
    file_hash = sha256_file(file_path)

    existentes = supabase.select(
        "compras_stock_imports",
        {
            "select": "id,estado,fecha_importacion",
            "source_system": f"eq.{SOURCE_SYSTEM}",
            "deposito": f"eq.{DEPOSITO}",
            "archivo_sha256": f"eq.{file_hash}",
            "limit": "1",
        },
    )

    if existentes:
        existing = existentes[0]
        raise RuntimeError(
            f"El archivo ya fue registrado en Supabase "
            f"(importación #{existing['id']}, estado {existing['estado']})."
        )

    validar_variacion(parsed, supabase, force)

    now_iso = datetime.now(TZ).isoformat()

    metadata = {
        "parserVersion": "wms-warnes-python-v2",
        "uniqueSkus": parsed.unique_skus,
        "duplicateSkus": parsed.duplicate_skus,
        "totalStock": parsed.total_stock,
        "automation": "playwright",
    }

    created = supabase.insert(
        "compras_stock_imports",
        {
            "source_system": SOURCE_SYSTEM,
            "deposito": DEPOSITO,
            "archivo_origen": file_path.name,
            "archivo_sha256": file_hash,
            "fecha_archivo": None,
            "fecha_importacion": now_iso,
            "estado": "PROCESANDO",
            "filas_origen": parsed.source_rows,
            "filas_validas": parsed.unique_skus,
            "filas_rechazadas": 0,
            "error_message": None,
            "metadata": metadata,
            "updated_at": now_iso,
        },
        return_representation=True,
    )

    if not created:
        raise RuntimeError("Supabase no devolvió el ID de la importación.")

    import_id = int(created[0]["id"])

    try:
        rows = [
            {
                "import_id": import_id,
                "sku": str(row.SKU),
                "stock": float(row.STOCK),
                "source_row_number": None,
            }
            for row in parsed.items.itertuples(index=False)
        ]

        for start in range(0, len(rows), 500):
            supabase.insert(
                "compras_stock_import_items",
                rows[start : start + 500],
            )

        supabase.update(
            "compras_stock_imports",
            {"id": f"eq.{import_id}"},
            {
                "estado": "VALIDADO",
                "error_message": None,
                "updated_at": datetime.now(TZ).isoformat(),
            },
        )
        return import_id

    except Exception as exc:
        supabase.update(
            "compras_stock_imports",
            {"id": f"eq.{import_id}"},
            {
                "estado": "ERROR",
                "error_message": str(exc)[:4000],
                "updated_at": datetime.now(TZ).isoformat(),
            },
        )
        raise


def _locator_exists(locator) -> bool:
    try:
        return locator.count() > 0
    except Exception:
        return False


def _buscar_selector_warnes(page):
    selector = page.locator('select[name="vCTRODISTRIBUCION"]')
    if _locator_exists(selector):
        return selector

    selectors = page.locator("select")
    for index in range(selectors.count()):
        candidate = selectors.nth(index)
        try:
            options = candidate.locator("option").evaluate_all(
                "(opts) => opts.map(o => ({value:o.value, text:(o.textContent || '').trim()}))"
            )
            if any(
                str(option.get("value")) == WMS_DEPOSITO_VALUE
                and "WARNES" in str(option.get("text", "")).upper()
                for option in options
            ):
                return candidate
        except Exception:
            continue

    return None


def descargar_reporte_wms(headed: bool = False) -> Path:
    from playwright.sync_api import sync_playwright

    base_url = env_required("WMS_BASE_URL").rstrip("/")
    username = env_required("WMS_USERNAME")
    password = env_required("WMS_PASSWORD")

    entrada_dir = Path(
        os.getenv("WMS_DOWNLOAD_DIR", "entrada")
    ).expanduser().resolve()
    entrada_dir.mkdir(parents=True, exist_ok=True)

    browser_channel = (
        os.getenv("WMS_BROWSER_CHANNEL", "chrome").strip() or None
    )

    log("Abriendo WMS...")

    with sync_playwright() as p:
        launch_kwargs: dict[str, Any] = {"headless": not headed}
        if browser_channel:
            launch_kwargs["channel"] = browser_channel

        browser = p.chromium.launch(**launch_kwargs)
        context = browser.new_context(accept_downloads=True)
        page = context.new_page()
        page.set_default_timeout(30_000)

        try:
            page.goto(
                f"{base_url}/hinicio.aspx",
                wait_until="domcontentloaded",
            )

            user = page.locator('[name="vUSR"]')
            passwd = page.locator('[name="vPASSWORD"]')

            if not _locator_exists(user) or not _locator_exists(passwd):
                raise RuntimeError(
                    "No encontré los campos de usuario/contraseña en hinicio.aspx."
                )

            user.fill(username)
            passwd.fill(password)

            login_button = page.locator('[name="BUTTON3"]')
            if not _locator_exists(login_button):
                login_button = page.get_by_text("INGRESAR", exact=True)

            login_button.click()
            page.wait_for_load_state("domcontentloaded")
            page.wait_for_timeout(800)

            # IMPORTANTE:
            # Después del login, WMS muestra una pantalla intermedia para elegir
            # el centro de distribución. Hay que resolverla ANTES de navegar a ubicart.
            cd_login = _buscar_selector_warnes(page)

            if cd_login is not None and _locator_exists(cd_login):
                log("Seleccionando sede CD WARNES...")
                cd_login.select_option(WMS_DEPOSITO_VALUE)

                accept_login = page.locator('[name="BUTTON4"]')
                if not _locator_exists(accept_login):
                    accept_login = page.get_by_role(
                        "button",
                        name="Aceptar",
                    )
                if not _locator_exists(accept_login):
                    accept_login = page.get_by_text(
                        "Aceptar",
                        exact=True,
                    )

                if not _locator_exists(accept_login):
                    raise RuntimeError(
                        "Detecté la selección de sede, "
                        "pero no encontré el botón Aceptar."
                    )

                old_url = page.url
                accept_login.click()

                try:
                    page.wait_for_url(
                        lambda url: url != old_url,
                        timeout=15_000,
                    )
                except Exception:
                    page.wait_for_timeout(1500)

                try:
                    page.wait_for_load_state(
                        "domcontentloaded",
                        timeout=10_000,
                    )
                except Exception:
                    pass

                page.wait_for_timeout(700)

                # No validamos por la existencia del selector de CD:
                # WMS mantiene un selector de centro de distribución también
                # dentro del dashboard principal. Validamos por señales de que
                # la sesión ya avanzó fuera de la pantalla intermedia.
                dashboard_ok = (
                    _locator_exists(page.get_by_text("Procesos WMS", exact=True))
                    or _locator_exists(page.get_by_text("Consultas", exact=True))
                    or _locator_exists(page.get_by_text("Tablero Comando", exact=True))
                    or "tablerocomando" in page.url.lower()
                    or "trabajarconwms" in page.url.lower()
                )

                if not dashboard_ok:
                    # Último intento: esperar un poco más porque GeneXus puede
                    # completar el postback después del click.
                    page.wait_for_timeout(1500)
                    dashboard_ok = (
                        _locator_exists(page.get_by_text("Procesos WMS", exact=True))
                        or _locator_exists(page.get_by_text("Consultas", exact=True))
                        or _locator_exists(page.get_by_text("Tablero Comando", exact=True))
                    )

                if not dashboard_ok:
                    raise RuntimeError(
                        "No pude confirmar que WMS haya salido de la pantalla de selección de sede."
                    )

                log("Sede CD WARNES: OK")

            log("Login WMS: OK")
            page.wait_for_timeout(1000)

            # Navegamos igual que un usuario real para evitar los abortos
            # de GeneXus al entrar directamente a ubicart.aspx.
            log("Abriendo Procesos WMS...")

            procesos = page.get_by_text("Procesos WMS", exact=True)
            if not _locator_exists(procesos):
                procesos = page.locator('a[href*="trabajarconwms" i]').first

            if not _locator_exists(procesos):
                raise RuntimeError("No encontré el acceso a 'Procesos WMS'.")

            procesos.click()
            try:
                page.wait_for_load_state("domcontentloaded", timeout=15_000)
            except Exception:
                pass
            page.wait_for_timeout(1000)

            log("Abriendo Stock de Contenedores por Artículo...")

            stock_link = page.get_by_text(
                "Stock de Contenedores por Artículo",
                exact=True,
            )
            if not _locator_exists(stock_link):
                stock_link = page.locator('a[href*="ubicart.aspx" i]').first

            if not _locator_exists(stock_link):
                raise RuntimeError(
                    "No encontré 'Stock de Contenedores por Artículo' "
                    "dentro de Procesos WMS/Consultas."
                )

            stock_link.click()
            try:
                page.wait_for_load_state("domcontentloaded", timeout=15_000)
            except Exception:
                pass
            page.wait_for_timeout(1000)

            deposito = page.locator('select[name="vSUCURSAL"]')
            if not _locator_exists(deposito):
                raise RuntimeError(
                    "No encontré el selector de depósito vSUCURSAL "
                    "en Stock de Contenedores por Artículo."
                )

            log("Seleccionando stock CD WARNES...")
            deposito.select_option(WMS_DEPOSITO_VALUE)
            page.wait_for_timeout(1000)

            # El reporte correcto se genera SIN detalle de contenedores.
            detalle = page.locator('input[name="vCONDETALLE"]')
            if not _locator_exists(detalle):
                detalle = page.locator('#vCONDETALLE')

            if _locator_exists(detalle):
                try:
                    if detalle.is_checked():
                        log("Desmarcando 'Con Detalle de Contenedores'...")
                        detalle.uncheck()
                        page.wait_for_timeout(500)
                except Exception:
                    pass

            accept = page.locator('[name="BUTTON1"]')
            if not _locator_exists(accept):
                accept = page.get_by_role("button", name="Aceptar")
            if not _locator_exists(accept):
                accept = page.get_by_text("Aceptar", exact=True)

            if not _locator_exists(accept):
                raise RuntimeError(
                    "No encontré el botón Aceptar en la consulta de stock."
                )

            log("Generando reporte...")
            accept.click()
            page.wait_for_timeout(1800)

            excel = page.locator('[name="vIMG2"]')
            if not _locator_exists(excel):
                excel = page.locator("#vIMG2")
            if not _locator_exists(excel):
                excel = page.locator(
                    'img[src*="excel" i], input[src*="excel" i]'
                ).first

            if not _locator_exists(excel):
                raise RuntimeError(
                    "No encontré el botón/ícono de Excel (vIMG2)."
                )

            log("Generando y descargando XLS de CD WARNES...")

            with page.expect_download(timeout=60_000) as download_info:
                excel.click()

            download = download_info.value
            suggested = (
                download.suggested_filename
                or datetime.now(TZ).strftime("%Y%m%d%H%M%S") + ".XLS"
            )

            destino = entrada_dir / suggested
            download.save_as(str(destino))

            if not destino.exists() or destino.stat().st_size < 1000:
                raise RuntimeError(
                    "La descarga terminó, pero el XLS está vacío "
                    "o es demasiado pequeño."
                )

            log(f"Archivo descargado: {destino.name}")
            return destino

        finally:
            context.close()
            browser.close()


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza automáticamente stock WARNES "
            "desde WMS hacia Supabase."
        )
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Abre Chrome visible. Recomendado para la primera prueba.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Descarga y procesa el XLS, pero no escribe en Supabase.",
    )
    parser.add_argument(
        "--archivo",
        help="Usa un XLS/XLSX local y omite la descarga desde WMS.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Permite una variación extraordinaria respecto al snapshot anterior.",
    )
    args = parser.parse_args()

    try:
        if args.archivo:
            file_path = Path(args.archivo).expanduser().resolve()
            log(f"Usando archivo local: {file_path.name}")
        else:
            file_path = descargar_reporte_wms(headed=args.headed)

        parsed = leer_reporte_wms(file_path)

        log(
            f"Filas fuente: {parsed.source_rows:,}".replace(",", ".")
        )
        log(
            f"SKU únicos: {parsed.unique_skus:,}".replace(",", ".")
        )
        log(
            f"SKU duplicados consolidados: "
            f"{parsed.duplicate_skus:,}".replace(",", ".")
        )
        log(
            f"Stock total WARNES: "
            f"{parsed.total_stock:,.0f}".replace(",", ".")
        )

        if args.dry_run:
            log("DRY RUN OK: no se escribió nada en Supabase.")
            return 0

        import_id = guardar_snapshot_supabase(
            parsed,
            file_path,
            force=args.force,
        )

        log(f"Supabase: importación #{import_id} VALIDADA.")
        log("Sincronización WARNES finalizada correctamente.")
        return 0

    except Exception as exc:
        log(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
