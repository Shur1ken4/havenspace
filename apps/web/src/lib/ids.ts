const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Rejects malformed ids before they reach the database (which would error). */
export const isUuid = (id: string) => UUID.test(id);
