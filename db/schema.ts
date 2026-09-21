import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    documentType: text("document_type").notNull(),
    filename: text("filename").notNull(),
    objectKey: text("object_key").notNull().unique(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedById: text("uploaded_by_id").notNull(),
    uploadedByEmail: text("uploaded_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_documents_product_id").on(table.productId)],
);

export const documentRequests = pgTable(
  "document_requests",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    productName: text("product_name").notNull(),
    requestedTypes: text("requested_types").notNull(),
    note: text("note").notNull().default(""),
    requesterId: text("requester_id").notNull(),
    requesterEmail: text("requester_email").notNull(),
    status: text("status").notNull().default("pending"),
    resolvedByEmail: text("resolved_by_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_document_requests_product_id").on(table.productId),
    index("idx_document_requests_status").on(table.status),
  ],
);
