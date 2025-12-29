const GHL_BASE = process.env.GHL_API_BASE || "https://services.leadconnectorhq.com";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "nPLGDpS1HjcAtlJurRFr";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY || ""}`,
    "Content-Type": "application/json",
  };
}

export async function upsertContact({ submission, normalized, docUrl }) {
  if (!process.env.GHL_API_KEY) {
    return { id: null };
  }

  const payload = {
    locationId: LOCATION_ID,
    firstName: submission.first_name,
    lastName: submission.last_name,
    email: submission.email || "",
    phone: submission.phone || "",
    address1: normalized.street_address,
    city: normalized.city,
    state: normalized.state,
    postalCode: normalized.zip_code,
    tags: ["auto estimate"],
  };

  const response = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { id: null };
  }

  const data = await response.json();
  const contactId = data?.contact?.id || data?.id || null;
  if (!contactId) {
    return { id: null };
  }

  await setEstimateDocField(contactId, docUrl);
  return { id: contactId };
}

async function setEstimateDocField(contactId, docUrl) {
  if (!docUrl) return;

  const payload = {
    contactId,
    customField: {
      name: "Estimate Doc URL",
      value: docUrl,
    },
  };

  await fetch(`${GHL_BASE}/contacts/${contactId}/custom-fields`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function addContactNote(contactId, { note }) {
  if (!contactId || !note || !process.env.GHL_API_KEY) return;

  await fetch(`${GHL_BASE}/contacts/${contactId}/notes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      body: note,
      userId: process.env.GHL_USER_ID || "",
    }),
  });
}

export async function createDraftEstimate({ contactId, normalized, pricing, docUrl }) {
  if (!process.env.GHL_API_KEY) {
    return { success: false };
  }

  const payload = {
    contactId,
    locationId: LOCATION_ID,
    name: `Auto Estimate – ${normalized.street_address || normalized.full_address}`,
    status: "draft",
    lineItems: pricing.line_items.map((item) => ({
      name: item.name,
      price: item.unit_price,
      quantity: item.qty,
    })),
    total: pricing.estimated_total,
    notes: docUrl ? `Estimate Doc: ${docUrl}` : "",
  };

  const response = await fetch(`${GHL_BASE}/estimates`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  return { success: response.ok };
}

export async function createOpportunityFallback({ contactId, normalized, pricing, docUrl }) {
  if (!process.env.GHL_API_KEY) return;

  const opportunityPayload = {
    locationId: LOCATION_ID,
    contactId,
    name: `Estimate – ${normalized.street_address || normalized.full_address}`,
    status: "open",
    monetaryValue: pricing.estimated_total,
    notes: docUrl ? `Estimate Doc: ${docUrl}` : "",
  };

  const oppResponse = await fetch(`${GHL_BASE}/opportunities`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(opportunityPayload),
  });

  if (!oppResponse.ok) return;

  const tasksPayload = {
    locationId: LOCATION_ID,
    title: `Pricing details for ${normalized.street_address || normalized.full_address}`,
    dueDate: new Date().toISOString(),
    body: buildTaskBody(pricing, docUrl),
  };

  await fetch(`${GHL_BASE}/tasks`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(tasksPayload),
  });
}

function buildTaskBody(pricing, docUrl) {
  const items = pricing.line_items
    .map((item) => `${item.name}: $${item.unit_price.toFixed(2)}`)
    .join("\n");
  return `Estimate items:\n${items}\nTotal: $${pricing.estimated_total.toFixed(2)}\nDoc: ${docUrl || ""}`;
}
