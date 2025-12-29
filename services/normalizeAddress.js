import { safeJsonParse } from "./utils.js";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function normalizeAddress(rawAddress) {
  if (!rawAddress) {
    return {
      street_address: "",
      city: "",
      state: "",
      zip_code: "",
      full_address: rawAddress || "",
      isValid: false,
      isAmbiguous: true,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      street_address: rawAddress,
      city: "",
      state: "",
      zip_code: "",
      full_address: rawAddress,
      isValid: false,
      isAmbiguous: true,
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const systemPrompt =
    "You normalize US addresses. Return strict JSON with keys: street_address, city, state, zip_code, full_address, isValid, isAmbiguous.";

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Normalize this address: ${rawAddress}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    return {
      street_address: rawAddress,
      city: "",
      state: "",
      zip_code: "",
      full_address: rawAddress,
      isValid: false,
      isAmbiguous: true,
    };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = safeJsonParse(content || "");

  if (!parsed) {
    return {
      street_address: rawAddress,
      city: "",
      state: "",
      zip_code: "",
      full_address: rawAddress,
      isValid: false,
      isAmbiguous: true,
    };
  }

  return {
    street_address: parsed.street_address || "",
    city: parsed.city || "",
    state: parsed.state || "",
    zip_code: parsed.zip_code || "",
    full_address: parsed.full_address || rawAddress,
    isValid: Boolean(parsed.isValid),
    isAmbiguous: Boolean(parsed.isAmbiguous),
  };
}
