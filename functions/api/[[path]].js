// Unknown API routes (e.g. /api/phone, which only exists on the Mac) → JSON 404.
export const onRequest = () => Response.json({ error: "Not found" }, { status: 404 });
