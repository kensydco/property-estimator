import { google } from "googleapis";

const GOOGLE_DOCS_FOLDER_ID =
  process.env.GOOGLE_DOCS_FOLDER_ID || "19BYVwi40CXifgx1ATrjil6t9DmsMw59A";

export async function createEstimateDoc({
  submission,
  normalized,
  enrichment,
  pricing,
  errorFlags,
}) {
  const credentialsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsRaw) {
    return { url: "", docId: "" };
  }

  let credentials;
  try {
    credentials = JSON.parse(credentialsRaw);
  } catch (error) {
    return { url: "", docId: "" };
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive",
    ],
  });

  const docs = google.docs({ version: "v1", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Estimate – ${normalized.street_address || submission.property_address}`;
  const docResponse = await docs.documents.create({
    requestBody: { title },
  });

  const docId = docResponse.data.documentId;
  if (!docId) {
    return { url: "", docId: "" };
  }

  const content = buildDocContent({
    submission,
    normalized,
    enrichment,
    pricing,
    errorFlags,
  });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });

  await drive.files.update({
    fileId: docId,
    addParents: GOOGLE_DOCS_FOLDER_ID,
    removeParents: "root",
    fields: "id, parents",
  });

  const docUrl = `https://docs.google.com/document/d/${docId}`;
  return { url: docUrl, docId };
}

function buildDocContent({ submission, normalized, enrichment, pricing, errorFlags }) {
  const services = (submission.services_requested || []).map((service) => `- ${service}`).join("\n");
  const pricingRows = pricing.line_items
    .map(
      (item) =>
        `${item.name} | ${item.qty} | $${item.unit_price.toFixed(2)} | $${item.total.toFixed(2)}`,
    )
    .join("\n");

  const estimateTotal = `$${pricing.estimated_total.toFixed(2)}`;
  const ownerOrContact =
    submission.property_type === "Residential"
      ? enrichment.owner_name || ""
      : enrichment.contact_name || enrichment.company_name || "";

  const contactInfo = [submission.email, submission.phone].filter(Boolean).join(" / ");

  const enrichmentDetails =
    submission.property_type === "Residential"
      ? [
          `Owner name: ${enrichment.owner_name || ""}`,
          `Sqft: ${enrichment.sqft || pricing.resolved_sqft || ""}`,
          `Lot size: ${enrichment.lot_size || ""}`,
          `Assessed value: ${enrichment.assessed_value || ""}`,
        ].join("\n")
      : [
          `Company name: ${enrichment.company_name || submission.company_name || ""}`,
          `Contact: ${enrichment.contact_name || ""}`,
          `Job title: ${enrichment.job_title || ""}`,
          `Email: ${enrichment.email || ""}`,
          `Phone: ${enrichment.phone || ""}`,
        ].join("\n");

  const fieldNotes = [
    `Special conditions: ${submission.special_conditions || ""}`,
    `Access notes: ${submission.access_notes || ""}`,
    `Timing preference: ${submission.timing_preference || ""}`,
  ].join("\n");

  const metadata = [
    `Source: ${submission.source || "web_form"}`,
    `Submission timestamp: ${submission.submission_timestamp || ""}`,
    `Tag: auto estimate`,
    errorFlags?.length ? `Error flags: ${errorFlags.join("; ")}` : "Error flags: none",
  ].join("\n");

  const commercialLink =
    submission.property_type === "Commercial"
      ? `Commercial Measurement Link: https://www.google.com/maps?q=${encodeURIComponent(
          normalized.full_address || submission.property_address,
        )}&t=k`
      : "";

  return [
    "Estimate Summary",
    `Address: ${normalized.full_address || submission.property_address}`,
    `Property type: ${submission.property_type}`,
    `Owner / Contact / Company: ${ownerOrContact}`,
    contactInfo ? `Phone / Email: ${contactInfo}` : "Phone / Email: ",
    "",
    "Services Requested",
    services || "-",
    "",
    "Pricing Table",
    "Service | Qty | Unit Price | Total",
    pricingRows || "-",
    `Estimated Total: ${estimateTotal}`,
    "",
    "Enrichment Details",
    enrichmentDetails,
    "",
    "Field Notes",
    fieldNotes,
    commercialLink ? "" : null,
    commercialLink || null,
    "",
    "Metadata",
    metadata,
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
