import { createHash } from "node:crypto";
import { createReadStream, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createInflateRaw } from "node:zlib";

import { del, head, put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ZIP = path.join(PROJECT_ROOT, "document", "OneDrive_2026-09-22.zip");
const DEFAULT_REPORT = path.join(PROJECT_ROOT, "document", "document-import-report-2026-09-22.json");
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const IMPORT_BATCH = "2026-09-22";
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "zip"]);
const CONTENT_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  zip: "application/zip",
};

function usage() {
  console.log(`Usage: npm run documents:import -- [options]

Options:
  --dry-run             Create the report without uploading or changing the database (default).
  --execute             Upload files and insert metadata after the report is built.
  --zip <path>          ZIP source; defaults to document/OneDrive_2026-09-22.zip.
  --report <path>       JSON report; defaults to document/document-import-report-2026-09-22.json.
`);
}

function parseArgs(argv) {
  const options = { execute: false, zip: DEFAULT_ZIP, report: DEFAULT_REPORT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") options.execute = false;
    else if (arg === "--execute") options.execute = true;
    else if (arg === "--zip") options.zip = path.resolve(argv[++index] ?? "");
    else if (arg === "--report") options.report = path.resolve(argv[++index] ?? "");
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

async function loadEnvFiles() {
  for (const filename of [".env", ".env.local"]) {
    try {
      const contents = await fs.readFile(path.join(PROJECT_ROOT, filename), "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || match[1] in process.env) continue;
        process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/\u0111/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extensionOf(filename) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function classifyDocument(entryPath) {
  const value = entryPath.toLocaleLowerCase("en-US");
  if (value.includes("/sds/") || /(^|[^a-z])sds([^a-z]|$)/.test(value)) return "SDS";
  if (value.includes("/tds/") || /(^|[^a-z])tds([^a-z]|$)/.test(value)) return "TDS";
  if (value.includes("/coa/") || value.includes("certificate of analysis") || /(^|[^a-z])coa([^a-z]|$)/.test(value)) return "COA";
  if (value.includes("composition")) return "Composition";
  if (value.includes("country of origin") || value.includes("origin statement") || value.includes("/coo/")) return "COO";
  if (
    value.includes("/presentation") ||
    value.includes("/presentations") ||
    value.includes("brochure") ||
    value.includes("magazine") ||
    value.includes("media kit") ||
    value.includes("media kits") ||
    value.includes("poster")
  ) return "Presentation";
  if (value.includes("clinical") || value.includes("in vitro")) return "Clinical Test";
  if (value.includes("/csr/") || value.includes("sustainability profile") || value.includes("sustainability report")) return "RIS";
  if (
    value.includes("technical/summary") ||
    value.includes("data pack") ||
    value.includes("datapack") ||
    value.includes("formulation advice") ||
    value.includes("formulation database") ||
    value.includes("formulation inspiration") ||
    value.includes("technical article") ||
    value.includes("product information")
  ) return "Product Information";
  if (
    value.includes("/statements/") ||
    value.includes("certificate") ||
    value.includes("declaration") ||
    value.includes("free from")
  ) return "Certificate";
  return "Other";
}

function safeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-140) || "document";
}

function entryIdentity(entry, productId) {
  return createHash("sha256")
    .update(`${productId}\0${entry.path}\0${entry.crc32}\0${entry.uncompressedSize}`)
    .digest("hex");
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

async function readAt(handle, position, length) {
  const buffer = Buffer.alloc(length);
  const result = await handle.read(buffer, 0, length, position);
  if (result.bytesRead !== length) throw new Error(`Unexpected end of ZIP at byte ${position}.`);
  return buffer;
}

async function readZipEntries(zipPath) {
  const handle = await fs.open(zipPath, "r");
  try {
    const { size } = await handle.stat();
    const tailLength = Math.min(size, 0xffff + 22);
    const tail = await readAt(handle, size - tailLength, tailLength);
    const eocdSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
    const eocdOffset = tail.lastIndexOf(eocdSignature);
    if (eocdOffset < 0) throw new Error("ZIP end-of-central-directory record was not found.");
    const centralDirectorySize = readUInt32(tail, eocdOffset + 12);
    const centralDirectoryOffset = readUInt32(tail, eocdOffset + 16);
    if (centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
      throw new Error("ZIP64 archives are not supported by this importer.");
    }

    const centralDirectory = await readAt(handle, centralDirectoryOffset, centralDirectorySize);
    const entries = [];
    const decoder = new TextDecoder("utf-8");
    let offset = 0;
    while (offset + 46 <= centralDirectory.length) {
      if (readUInt32(centralDirectory, offset) !== 0x02014b50) break;
      const flags = centralDirectory.readUInt16LE(offset + 8);
      const compression = centralDirectory.readUInt16LE(offset + 10);
      const crc32 = readUInt32(centralDirectory, offset + 16);
      const compressedSize = readUInt32(centralDirectory, offset + 20);
      const uncompressedSize = readUInt32(centralDirectory, offset + 24);
      const filenameLength = centralDirectory.readUInt16LE(offset + 28);
      const extraLength = centralDirectory.readUInt16LE(offset + 30);
      const commentLength = centralDirectory.readUInt16LE(offset + 32);
      const localHeaderOffset = readUInt32(centralDirectory, offset + 42);
      const nameBytes = centralDirectory.subarray(offset + 46, offset + 46 + filenameLength);
      const entryPath = decoder.decode(nameBytes);
      entries.push({
        path: entryPath,
        flags,
        compression,
        crc32,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
      offset += 46 + filenameLength + extraLength + commentLength;
    }
    return { handle, entries };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

async function entryStream(zipPath, handle, entry) {
  const localHeader = await readAt(handle, entry.localHeaderOffset, 30);
  if (readUInt32(localHeader, 0) !== 0x04034b50) throw new Error(`Invalid local header for ${entry.path}.`);
  const filenameLength = localHeader.readUInt16LE(26);
  const extraLength = localHeader.readUInt16LE(28);
  const start = entry.localHeaderOffset + 30 + filenameLength + extraLength;
  const source = createReadStream(zipPath, { start, end: start + entry.compressedSize - 1 });
  if (entry.compression === 0) return source;
  if (entry.compression === 8) return source.pipe(createInflateRaw());
  source.destroy();
  throw new Error(`Unsupported ZIP compression method ${entry.compression} for ${entry.path}.`);
}

function splitIngredientPath(entryPath) {
  const parts = entryPath.split("/");
  if (parts.length < 3 || !parts[0].endsWith(" Ingredients")) return null;
  return { supplier: parts[0].slice(0, -" Ingredients".length), folder: parts[1] };
}

function skip(reason, entry, extra = {}) {
  return { path: entry.path, reason, ...extra };
}

async function writeReport(report, reportPath) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  await loadEnvFiles();
  const options = parseArgs(process.argv.slice(2));
  const catalogPath = path.join(PROJECT_ROOT, "app", "data", "catalog.json");
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const ingredients = Array.isArray(catalog.ingredients) ? catalog.ingredients : [];
  const candidates = new Map();
  for (const ingredient of ingredients) {
    if (!ingredient?.id || !ingredient?.name || !ingredient?.supplier) continue;
    const key = `${normalize(ingredient.supplier)}\0${normalize(ingredient.name)}`;
    const rows = candidates.get(key) ?? [];
    rows.push(ingredient);
    candidates.set(key, rows);
  }

  const zipPath = options.zip;
  const zipStat = await fs.stat(zipPath);
  const { handle, entries } = await readZipEntries(zipPath);
  const matched = new Map();
  const planned = [];
  const skipped = [];
  const folderStats = new Map();
  const typeCounts = new Map();

  try {
    for (const entry of entries) {
      if (entry.path.endsWith("/")) continue;
      const location = splitIngredientPath(entry.path);
      if (!location) {
        skipped.push(skip("no-ingredient-folder", entry));
        continue;
      }
      const folderKey = `${normalize(location.supplier)}\0${normalize(location.folder)}`;
      const rows = candidates.get(folderKey) ?? [];
      const statKey = `${location.supplier}\0${location.folder}`;
      const folder = folderStats.get(statKey) ?? { supplier: location.supplier, folder: location.folder, files: 0, matched: false };
      folder.files += 1;
      folderStats.set(statKey, folder);
      if (rows.length !== 1) {
        skipped.push(skip(rows.length === 0 ? "no-exact-catalog-id" : "ambiguous-catalog-match", entry, { supplier: location.supplier, folder: location.folder }));
        continue;
      }
      const ingredient = rows[0];
      folder.matched = true;
      const matchKey = ingredient.id;
      matched.set(matchKey, { id: ingredient.id, supplier: ingredient.supplier, name: ingredient.name, folder: location.folder });
      const extension = extensionOf(entry.path);
      if (entry.flags & 1) {
        skipped.push(skip("encrypted-entry", entry, { productId: ingredient.id, ingredient: ingredient.name }));
        continue;
      }
      if (entry.compression !== 0 && entry.compression !== 8) {
        skipped.push(skip("unsupported-compression", entry, { productId: ingredient.id, ingredient: ingredient.name, compression: entry.compression }));
        continue;
      }
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        skipped.push(skip("unsupported-extension", entry, { productId: ingredient.id, ingredient: ingredient.name, extension }));
        continue;
      }
      if (entry.uncompressedSize <= 0) {
        skipped.push(skip("empty-file", entry, { productId: ingredient.id, ingredient: ingredient.name }));
        continue;
      }
      if (entry.uncompressedSize > MAX_FILE_BYTES) {
        skipped.push(skip("over-15mb-limit", entry, { productId: ingredient.id, ingredient: ingredient.name, sizeBytes: entry.uncompressedSize }));
        continue;
      }
      const documentType = classifyDocument(entry.path);
      const identity = entryIdentity(entry, ingredient.id);
      const filename = entry.path.split("/").at(-1) ?? "document";
      planned.push({ entry, ingredient, documentType, identity, filename, extension });
      typeCounts.set(documentType, (typeCounts.get(documentType) ?? 0) + 1);
    }
  } finally {
    await handle.close();
  }

  const report = {
    source: path.relative(PROJECT_ROOT, zipPath).replaceAll(path.sep, "/"),
    sourceBytes: zipStat.size,
    generatedAt: new Date().toISOString(),
    mode: options.execute ? "execute" : "dry-run",
    matchingPolicy: "Exact normalized supplier + ingredient folder name only; no fuzzy or variant-to-base matching.",
    limits: { maxFileBytes: MAX_FILE_BYTES, allowedExtensions: [...ALLOWED_EXTENSIONS] },
    catalogMatches: [...matched.values()].map((item) => ({ ...item, plannedFiles: planned.filter((row) => row.ingredient.id === item.id).length })),
    unmatchedFolders: [...folderStats.values()].filter((item) => !item.matched),
    documentTypes: Object.fromEntries([...typeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    totals: {
      zipEntries: entries.filter((entry) => !entry.path.endsWith("/")).length,
      exactMatchedFiles: entries.filter((entry) => !entry.path.endsWith("/")).length - skipped.filter((item) => item.reason === "no-exact-catalog-id" || item.reason === "ambiguous-catalog-match" || item.reason === "no-ingredient-folder").length,
      plannedFiles: planned.length,
      skippedFiles: skipped.length,
      imported: 0,
      duplicateExisting: 0,
      failed: 0,
    },
    skipped,
    importedFiles: [],
    duplicateFiles: [],
    failures: [],
    verification: { status: "not-run", samples: [] },
  };

  await writeReport(report, options.report);
  console.log(`Preflight report written to ${path.relative(PROJECT_ROOT, options.report).replaceAll(path.sep, "/")}`);

  if (options.execute) {
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!connectionString) throw new Error("DATABASE_URL or POSTGRES_URL is required with --execute.");
    if (!blobToken) throw new Error("BLOB_READ_WRITE_TOKEN is required with --execute.");
    const sql = neon(connectionString);
    const existingRows = await sql`SELECT product_id, document_type, filename, size_bytes, object_key FROM documents`;
    const existingKeys = new Set(existingRows.map((row) => row.object_key));
    const existingMetadata = new Set(existingRows.map((row) => `${row.product_id}\0${row.document_type}\0${row.filename}\0${row.size_bytes}`));
    const existingMetadataLoose = new Set(existingRows.map((row) => `${row.product_id}\0${row.filename}\0${row.size_bytes}`));
    const importedBy = process.env.DOCUMENT_IMPORT_EMAIL ?? "migration@sapharchem.com";
    const importedById = process.env.DOCUMENT_IMPORT_USER_ID ?? `import:${IMPORT_BATCH}`;
    const freshZip = await readZipEntries(zipPath);
    try {
      for (let index = 0; index < planned.length; index += 1) {
        const item = planned[index];
        const key = `documents/${item.ingredient.id}/imports/${IMPORT_BATCH}/${item.identity.slice(0, 24)}-${safeFilename(item.filename)}`;
        const metadataKey = `${item.ingredient.id}\0${item.documentType}\0${item.filename}\0${item.entry.uncompressedSize}`;
        const metadataLooseKey = `${item.ingredient.id}\0${item.filename}\0${item.entry.uncompressedSize}`;
        if (existingKeys.has(key) || existingMetadata.has(metadataKey) || existingMetadataLoose.has(metadataLooseKey)) {
          report.totals.duplicateExisting += 1;
          report.duplicateFiles.push({ path: item.entry.path, productId: item.ingredient.id, ingredient: item.ingredient.name, objectKey: key, reason: existingKeys.has(key) ? "same-import-object-key" : "same-product-name-size" });
          continue;
        }
        let blob = null;
        try {
          const source = await entryStream(zipPath, freshZip.handle, item.entry);
          blob = await put(key, source, { access: "public", contentType: CONTENT_TYPES[item.extension] ?? "application/octet-stream", token: blobToken, addRandomSuffix: false });
          const id = `doc-${item.identity.slice(0, 32)}`;
          const inserted = await sql`
            INSERT INTO documents (id, product_id, document_type, filename, object_key, content_type, size_bytes, uploaded_by_id, uploaded_by_email, created_at)
            VALUES (${id}, ${item.ingredient.id}, ${item.documentType}, ${item.filename}, ${key}, ${CONTENT_TYPES[item.extension] ?? "application/octet-stream"}, ${item.entry.uncompressedSize}, ${importedById}, ${importedBy}, NOW())
            ON CONFLICT (object_key) DO NOTHING
            RETURNING id
          `;
          if (!inserted.length) {
            await del(blob.url, { token: blobToken });
            report.totals.duplicateExisting += 1;
            report.duplicateFiles.push({ path: item.entry.path, productId: item.ingredient.id, objectKey: key, reason: "database-conflict" });
            continue;
          }
          existingKeys.add(key);
          existingMetadata.add(metadataKey);
          existingMetadataLoose.add(metadataLooseKey);
          report.totals.imported += 1;
          report.importedFiles.push({ path: item.entry.path, productId: item.ingredient.id, ingredient: item.ingredient.name, documentType: item.documentType, filename: item.filename, objectKey: key, url: blob.url });
        } catch (error) {
          if (blob) {
            try {
              await del(blob.url, { token: blobToken });
            } catch {
              // Keep the original failure in the report; cleanup is best effort.
            }
          }
          report.totals.failed += 1;
          report.failures.push({ path: item.entry.path, productId: item.ingredient.id, message: error instanceof Error ? error.message : String(error) });
        }
        if ((index + 1) % 25 === 0 || index + 1 === planned.length) console.log(`Processed ${index + 1}/${planned.length}`);
      }
    } finally {
      await freshZip.handle.close();
    }

    const verificationSamples = [...matched.values()].slice(0, 3);
    for (const sample of verificationSamples) {
      const rows = await sql`
        SELECT COUNT(*)::int AS count
        FROM documents
        WHERE product_id = ${sample.id}
          AND object_key LIKE ${`documents/${sample.id}/imports/${IMPORT_BATCH}/%`}
      `;
      const importedSample = report.importedFiles.find((item) => item.productId === sample.id);
      let downloadProbe = "not-run";
      if (importedSample) {
        try {
          await head(importedSample.objectKey, { token: blobToken });
          downloadProbe = "ok";
        } catch {
          downloadProbe = "failed";
        }
      }
      const batchDocumentsInDb = Number(rows[0]?.count ?? 0);
      const importedThisRun = report.importedFiles.filter((item) => item.productId === sample.id).length;
      report.verification.samples.push({
        productId: sample.id,
        ingredient: sample.name,
        importedThisRun,
        batchDocumentsInDb,
        downloadProbe,
        status: batchDocumentsInDb >= importedThisRun && (downloadProbe === "ok" || downloadProbe === "not-run") ? "ok" : "mismatch",
      });
    }
    report.verification.status = report.verification.samples.every((sample) => sample.status === "ok") ? "ok" : "mismatch";
  }

  await writeReport(report, options.report);
  console.log(`Report written to ${path.relative(PROJECT_ROOT, options.report).replaceAll(path.sep, "/")}`);
  console.log(`Planned ${report.totals.plannedFiles} file(s); skipped ${report.totals.skippedFiles}; imported ${report.totals.imported}; duplicates ${report.totals.duplicateExisting}; failures ${report.totals.failed}.`);
  if (report.totals.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
