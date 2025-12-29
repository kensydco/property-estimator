import { normalizeServices, toNumber } from "./utils.js";

const RESIDENTIAL_PRICES = {
  "House Washing": (sqft) => Math.max(250, 0.1 * sqft),
  "Driveway Cleaning": () => 150,
  "Sidewalk Cleaning": () => 75,
  "Deck Cleaning": () => 175,
  "Fence Cleaning": () => 150,
  "Roof Cleaning": () => 400,
  "Gutter Cleaning": () => 150,
  "Window Cleaning": () => 150,
  "Patio Cleaning": () => 150,
};

const COMMERCIAL_PRICES = {
  "Commercial Building Wash": (sqft) => Math.max(1000, 0.12 * sqft),
  "Fleet Washing": () => 0,
  "Post-Construction Cleanup": () => 0,
};

export function buildPricing({ propertyType, services, sqft }) {
  const normalizedServices = normalizeServices(services);
  const line_items = [];
  let estimated_total = 0;
  let hasAssumptions = false;
  let resolvedSqft = toNumber(sqft);

  if (!resolvedSqft && propertyType === "Residential") {
    resolvedSqft = 2500;
    hasAssumptions = true;
  }

  normalizedServices.forEach((service) => {
    let unitPrice = 0;
    if (propertyType === "Residential") {
      const pricingFn = RESIDENTIAL_PRICES[service];
      if (pricingFn) {
        unitPrice = pricingFn(resolvedSqft || 0);
      } else {
        hasAssumptions = true;
      }
    }

    if (propertyType === "Commercial") {
      const pricingFn = COMMERCIAL_PRICES[service];
      if (pricingFn) {
        unitPrice = pricingFn(resolvedSqft || 0);
        if (!resolvedSqft) {
          hasAssumptions = true;
        }
      } else {
        hasAssumptions = true;
      }
    }

    const total = unitPrice;
    estimated_total += total;
    line_items.push({
      name: service,
      qty: 1,
      unit_price: roundCurrency(unitPrice),
      total: roundCurrency(total),
    });
  });

  return {
    line_items,
    estimated_total: roundCurrency(estimated_total),
    resolved_sqft: resolvedSqft,
    hasAssumptions,
  };
}

function roundCurrency(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
