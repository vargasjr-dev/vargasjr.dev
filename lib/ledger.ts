// Ledger categories — the taxonomy maps to Schedule C (and related 1040)
// lines for Vargas JR, LLC, so tax reporting is a group-by on this field.
// Categories are metadata: reassignable, with every change audited in
// accounting_entry_edits. The financial substance of an entry (amount, date,
// account) stays immutable.

export const LEDGER_CATEGORIES = [
  // Income
  "revenue",
  "interest_income",
  "member_contributions",
  "refunds_received",
  // Expenses
  "software_subs",
  "contractors",
  "professional_services",
  "advertising",
  "travel",
  "meals",
  "office_supplies",
  "equipment",
  "bank_fees",
  "merchant_fees",
  "insurance",
  "taxes_licenses",
  "phone_internet",
  "shipping",
  "other_expense",
] as const;

export type LedgerCategory = (typeof LEDGER_CATEGORIES)[number];

export function isLedgerCategory(value: unknown): value is LedgerCategory {
  return (
    typeof value === "string" &&
    (LEDGER_CATEGORIES as readonly string[]).includes(value)
  );
}

// Mercury's `mercuryCategory` enum → our taxonomy. Unmapped values become
// null (uncategorized) and get corrected by hand — the audit trail covers it.
const MERCURY_CATEGORY_MAP: Record<string, LedgerCategory | null> = {
  Advertising: "advertising",
  Software: "software_subs",
  Fees: "bank_fees",
  Taxes: "taxes_licenses",
  Insurance: "insurance",
  Shipping: "shipping",
  Airlines: "travel",
  Lodging: "travel",
  CarRental: "travel",
  RideshareAndTaxis: "travel",
  GroundTransportation: "travel",
  OtherTravel: "travel",
  Parking: "travel",
  FuelAndGas: "travel",
  Conferences: "travel",
  Restaurants: "meals",
  FoodDelivery: "meals",
  ProfessionalServices: "professional_services",
  Legal: "professional_services",
  OfficeSupplies: "office_supplies",
  FacilitiesExpenses: "office_supplies",
  Electronics: "equipment",
  InternetAndTelephone: "phone_internet",
  Utilities: "phone_internet",
};

export function categoryFromMercury(
  mercuryCategory: string | null,
  kind: string,
): LedgerCategory | null {
  if (mercuryCategory && mercuryCategory in MERCURY_CATEGORY_MAP) {
    return MERCURY_CATEGORY_MAP[mercuryCategory] ?? null;
  }
  // Mercury doesn't categorize interest payments as a category — the kind
  // field carries it.
  if (kind === "interestPayment") return "interest_income";
  return null;
}
