"use client";

import { useEffect } from "react";

/** Remember the last dashboard key in this browser so /dashboard can reopen it. */
export function RememberKey({ token }: { token: string }) {
  useEffect(() => {
    localStorage.setItem("dropos:key", token);
  }, [token]);
  return null;
}
