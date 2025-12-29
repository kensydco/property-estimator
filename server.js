import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import { normalizeAddress } from "./services/normalizeAddress.js";
import { enrichResidential, enrichCommercial } from "./services/enrichment.js";
import { buildPricing } from "./services/pricing.js";
import { createEstimateDoc } from "./services/googleDocs.js";
import {
  upsertContact,
  createDraftEstimate,
  createOpportunityFallback,
  addContactNote,
} from "./services/ghl.js";
import { buildErrorFlags } from "./services/utils.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/submit", async (req, res) => {
  const submission = req.body;
  if (!submission?.property_address || !submission?.property_type) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  res.json({ status: "accepted" });

  setImmediate(async () => {
    await processSubmission(submission);
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`RS Property Estimation App listening on port ${PORT}`);
});

async function processSubmission(submission) {
  const errorFlags = [];

  const normalized = await normalizeAddress(submission.property_address);
  if (!normalized.isValid) {
    errorFlags.push("Address format could not be validated.");
  }
  if (normalized.isAmbiguous) {
    errorFlags.push("Address appears ambiguous and needs review.");
  }

  const propertyType = submission.property_type;
  let enrichment = { needsReview: false };

  if (propertyType === "Residential") {
    enrichment = await enrichResidential(normalized, submission);
    if (enrichment.needsReview) {
      errorFlags.push("RentCast enrichment failed.");
    }
  } else if (propertyType === "Commercial") {
    enrichment = await enrichCommercial(normalized, submission);
    if (enrichment.needsReview) {
      errorFlags.push("Lusha enrichment failed.");
    }
  }

  const pricing = buildPricing({
    propertyType,
    services: submission.services_requested || [],
    sqft: submission.estimated_sqft || enrichment.sqft,
  });

  if (pricing.hasAssumptions) {
    errorFlags.push("Pricing assumptions applied.");
  }

  const docResult = await createEstimateDoc({
    submission,
    normalized,
    enrichment,
    pricing,
    errorFlags,
  });

  if (!docResult?.url) {
    errorFlags.push("Google Doc creation failed.");
  }

  const ghlContact = await upsertContact({
    submission,
    normalized,
    docUrl: docResult?.url,
  });

  if (ghlContact?.id) {
    await addContactNote(ghlContact.id, {
      note: `Estimate doc ready: ${docResult?.url || "(missing)"}. Preferred contact: ${submission.email || submission.phone || "n/a"}.`,
    });
  }

  const estimateResult = await createDraftEstimate({
    contactId: ghlContact?.id,
    normalized,
    pricing,
    docUrl: docResult?.url,
  });

  if (!estimateResult?.success) {
    await createOpportunityFallback({
      contactId: ghlContact?.id,
      normalized,
      pricing,
      docUrl: docResult?.url,
    });
  }

  const finalFlags = buildErrorFlags(errorFlags, enrichment?.errors);
  if (finalFlags.length > 0) {
    console.warn("Submission processed with flags:", finalFlags);
  }
}
