const RENTCAST_ENDPOINT = process.env.RENTCAST_ENDPOINT || "";
const LUSHA_ENDPOINT = process.env.LUSHA_ENDPOINT || "";

export async function enrichResidential(normalized, submission) {
  if (!RENTCAST_ENDPOINT || !process.env.RENTCAST_API_KEY) {
    return { needsReview: true, errors: ["RentCast API not configured."] };
  }

  try {
    const response = await fetch(RENTCAST_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RENTCAST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address: normalized.full_address || submission.property_address,
      }),
    });

    if (!response.ok) {
      return { needsReview: true, errors: ["RentCast request failed."] };
    }

    const data = await response.json();
    return {
      needsReview: false,
      owner_name: data?.owner_name || data?.ownerName || "",
      email: data?.email || "",
      phone: data?.phone || "",
      sqft: data?.sqft || data?.squareFeet || null,
      lot_size: data?.lot_size || data?.lotSize || null,
      assessed_value: data?.assessed_value || data?.assessedValue || null,
    };
  } catch (error) {
    return { needsReview: true, errors: ["RentCast request failed."] };
  }
}

export async function enrichCommercial(normalized, submission) {
  if (!LUSHA_ENDPOINT || !process.env.LUSHA_API_KEY) {
    return { needsReview: true, errors: ["Lusha API not configured."] };
  }

  try {
    const response = await fetch(LUSHA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LUSHA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company_name: submission.company_name || "",
        address: normalized.street_address,
        city: normalized.city,
        state: normalized.state,
      }),
    });

    if (!response.ok) {
      return { needsReview: true, errors: ["Lusha request failed."] };
    }

    const data = await response.json();
    return {
      needsReview: false,
      company_name: data?.company_name || submission.company_name || "",
      contact_name: data?.contact_name || data?.name || "",
      job_title: data?.job_title || data?.title || "",
      email: data?.email || "",
      phone: data?.phone || "",
    };
  } catch (error) {
    return { needsReview: true, errors: ["Lusha request failed."] };
  }
}
