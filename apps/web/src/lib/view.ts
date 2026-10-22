// Admins switch one account between the therapist view and the client view of their
// own test client (migration 0019). The choice is remembered per browser, so a phone
// can be "the client" while a laptop stays "the therapist".
export const VIEW_COOKIE = "hs_view";
