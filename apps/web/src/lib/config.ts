// Single-engagement prototype: there's no engagement list/picker yet, so the
// app always operates on this one until real multi-engagement + auth-scoped
// selection exists. This is a routing default, not sample domain data —
// contrast with the old mock-data.ts import it replaces.
export const DEFAULT_ENGAGEMENT_ID = process.env.NEXT_PUBLIC_DEFAULT_ENGAGEMENT_ID || "eng_001";
