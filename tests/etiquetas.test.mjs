import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

let session = null;
let calls = [];
let insertError = null;
let bucketPublic = false;
let rowMissing = false;
let folderArchiveError = null;
let writtenValues = null;
const id = "812a7abe-4c13-4800-bca8-7f86ca4aaee7";
const row = { id, name: "Etiqueta", description: "", file_name: "etiqueta.json", size_bytes: 2, storage_path: `${id}/archivo`, created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", folder_id: null };
globalThis.__etiquetasTestAuth = () => Promise.resolve(session);
globalThis.__etiquetasTestAdmin = () => {
  calls.push("admin");
  return {
    storage: {
      getBucket: async () => ({ data: { public: bucketPublic }, error: null }),
      from: () => ({
        upload: async () => { calls.push("upload"); return { error: null }; },
        remove: async () => { calls.push("rollback"); return { error: null }; },
        download: async () => ({ data: new Blob(["{}"]), error: null }),
      }),
    },
    from: (table) => {
      const query = {
        select: () => query, eq: () => query,
        order: async () => ({ data: table === "etiquetas_files" ? [row] : [], error: null }),
        maybeSingle: async () => ({ data: rowMissing ? null : { ...row, ...writtenValues }, error: insertError }),
        insert: (values) => { calls.push("insert"); writtenValues = values; return query; },
        update: (values) => { calls.push("update"); writtenValues = values; return query; },
      };
      return query;
    },
    rpc: async () => { calls.push("archive-folder"); return { data: !rowMissing, error: folderArchiveError }; },
  };
};

const sourceModule = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: sourceModule("export {};"), shortCircuit: true };
    if (specifier === "@/auth") return { url: sourceModule("export const auth = () => globalThis.__etiquetasTestAuth();"), shortCircuit: true };
    if (specifier === "@/lib/supabase-admin") return {
      url: sourceModule("export const getSupabaseAdmin = () => globalThis.__etiquetasTestAdmin(); export const hasSupabaseAdminConfig = () => true;"), shortCircuit: true,
    };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    return nextResolve(specifier, context);
  },
});

const { POST, GET } = await import("../src/app/api/etiquetas/route.ts");
const { GET: readFile, PATCH: editFile, PUT: replaceFile, DELETE: deleteFile } = await import("../src/app/api/etiquetas/[id]/route.ts");
const { POST: createFolder, PATCH: editFolder, DELETE: deleteFolder } = await import("../src/app/api/etiquetas/carpetas/route.ts");
const { validateEtiquetaMetadata, validateEtiquetaJson, etiquetaContentType, etiquetaContentDisposition } = await import("../src/lib/etiquetas-validation.ts");
const { ETIQUETAS_MAX_FILE_SIZE } = await import("../src/lib/etiquetas-types.ts");

function form(contents = "{}", fileName = "etiqueta.json") {
  const data = new FormData();
  data.set("file", new File([contents], fileName));
  data.set("name", "Etiqueta");
  return data;
}
function request(data = form()) { return new Request("http://localhost/api/etiquetas", { method: "POST", body: data }); }
function login(email = "ignacio@grupo-aftermarket.com") { session = { user: { email } }; calls = []; insertError = null; bucketPublic = false; writtenValues = null; rowMissing = false; folderArchiveError = null; }
function jsonRequest(body) { return new Request("http://localhost/api/etiquetas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
const params = { params: Promise.resolve({ id }) };

test("lectura, descarga y publicación exigen sesión", async () => {
  session = null; calls = [];
  assert.equal((await GET()).status, 401);
  assert.equal((await POST(request())).status, 401);
  assert.equal((await readFile(new Request(`http://localhost/api/etiquetas/${id}`), { params: Promise.resolve({ id }) })).status, 401);
  assert.deepEqual(calls, []);
});

test("un usuario del portal puede consultar pero no publicar", async () => {
  login("lector@grupo-aftermarket.com");
  assert.equal((await POST(request())).status, 403);
  assert.deepEqual(calls, []);
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).files[0].fileName, row.file_name);
});

test("se rechazan sesiones de dominios no autorizados", async () => {
  login("persona@example.com");
  assert.equal((await GET()).status, 403);
  assert.equal((await POST(request())).status, 403);
  assert.equal((await readFile(new Request(`http://localhost/api/etiquetas/${id}`), { params: Promise.resolve({ id }) })).status, 403);
  assert.deepEqual(calls, []);
});

test("JSON inválido, archivo vacío y tamaño excesivo no se publican", async () => {
  login();
  assert.equal((await POST(request(form("{invalido}")))).status, 400);
  assert.equal((await POST(request(form("")))).status, 400);
  assert.throws(() => validateEtiquetaMetadata(form(new Uint8Array(ETIQUETAS_MAX_FILE_SIZE + 1))), /4 MB/);
  assert.deepEqual(calls, []);
  await validateEtiquetaJson(new File(["\uFEFF{}"], "base.JSON"), "base.JSON");
});

test("la publicación admite cualquier formato y conserva su nombre original", async () => {
  login();
  const data = form("archivo binario", "etiqueta.xlsx");
  assert.equal(validateEtiquetaMetadata(data).fileName, "etiqueta.xlsx");
  assert.equal((await POST(request(data))).status, 201);
  assert.deepEqual(calls, ["admin", "upload", "insert"]);
});

test("un fallo al registrar el archivo revierte exclusivamente la carga nueva", async () => {
  login(); insertError = new Error("database unavailable");
  assert.equal((await POST(request())).status, 503);
  assert.deepEqual(calls, ["admin", "upload", "insert", "rollback"]);
});

test("una biblioteca pública bloquea lectura del listado y publicación", async () => {
  login(); bucketPublic = true;
  assert.equal((await GET()).status, 503);
  assert.equal((await POST(request())).status, 503);
  assert.ok(!calls.includes("upload"));
});

test("las descargas conservan el contenido y no se almacenan en cachés compartidas", async () => {
  login("lector@grupo-aftermarket.com");
  const response = await readFile(new Request(`http://localhost/api/etiquetas/${id}?download=1`), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "{}");
  assert.match(response.headers.get("Content-Disposition"), /^attachment/);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal((await readFile(new Request("http://localhost/api/etiquetas/invalido"), { params: Promise.resolve({ id: "invalido" }) })).status, 404);
});

test("HTML y SVG se descargan como binarios y los nombres no inyectan cabeceras", () => {
  assert.equal(etiquetaContentType("pagina.html"), "application/octet-stream");
  assert.equal(etiquetaContentType("imagen.svg"), "application/octet-stream");
  assert.match(etiquetaContentDisposition('etiqueta ñ"\r\n.json', true), /filename\*=UTF-8''/);
  assert.ok(!etiquetaContentDisposition('etiqueta ñ"\r\n.json', true).includes("\r\n"));
});

test("crear, modificar, reemplazar y eliminar exige permisos administrativos", async () => {
  login("lector@grupo-aftermarket.com");
  for (const handler of [editFile, replaceFile, deleteFile]) assert.equal((await handler(request(), params)).status, 403);
  for (const handler of [createFolder, editFolder, deleteFolder]) assert.equal((await handler(jsonRequest({ id, name: "Carpeta" }))).status, 403);
  assert.deepEqual(calls, []);
});

test("modificar nombre, descripción y carpeta conserva el archivo almacenado", async () => {
  login();
  const result = await editFile(jsonRequest({ name: "Etiqueta actualizada", description: "Estándar", folderId: id }), params);
  assert.equal(result.status, 200);
  assert.equal(writtenValues.name, "Etiqueta actualizada");
  assert.equal(writtenValues.folder_id, id);
  assert.equal(writtenValues.storage_path, undefined);
  assert.ok(!calls.includes("upload"));
});

test("reemplazar conserva el acceso y guarda el archivo en una ruta nueva", async () => {
  login();
  const result = await replaceFile(request(form('{"version":2}', "base-nueva.json")), params);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).file.id, id);
  assert.equal(writtenValues.file_name, "base-nueva.json");
  assert.match(writtenValues.storage_path, new RegExp(`^${id}/`));
  assert.notEqual(writtenValues.storage_path, row.storage_path);
  assert.ok(!calls.includes("rollback"));
});

test("eliminar un acceso es lógico y un acceso inexistente no se reemplaza", async () => {
  login();
  assert.equal((await deleteFile(request(), params)).status, 200);
  assert.equal(writtenValues.is_active, false);
  assert.ok(!calls.includes("rollback"));
  login(); rowMissing = true;
  assert.equal((await replaceFile(request(), params)).status, 404);
  assert.ok(!calls.includes("upload"));
});

test("carpetas se crean, renombran y rechazan nombres repetidos", async () => {
  login();
  assert.equal((await createFolder(jsonRequest({ name: "Productos", description: "Plantillas" }))).status, 201);
  assert.equal(writtenValues.name, "Productos");
  assert.equal((await editFolder(jsonRequest({ id, name: "Productos estándar" }))).status, 200);
  insertError = { code: "23505" };
  assert.equal((await createFolder(jsonRequest({ name: "Productos" }))).status, 409);
});

test("eliminar una carpeta con archivos se rechaza en el servidor", async () => {
  login(); folderArchiveError = { code: "P0001" };
  assert.equal((await deleteFolder(jsonRequest({ id }))).status, 409);
  folderArchiveError = null;
  assert.equal((await deleteFolder(jsonRequest({ id }))).status, 200);
  assert.ok(!calls.includes("rollback"));
});
