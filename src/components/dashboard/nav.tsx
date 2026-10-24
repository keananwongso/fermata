"use client";
// Where the dashboard window is: which view, and which case room inside it. Views switch in place, so anything inside
// the window (a Review link, a room row) moves it with `useDashboardNav()` instead of navigating away.
import { createContext, useContext } from "react";

export type Nav = { view: string; room: string | null };
export const HOME: Nav = { view: "overview", room: null };

export const DashboardNav = createContext<(to: Nav) => void>(() => {});
export const useDashboardNav = () => useContext(DashboardNav);

// `?view=rules`, `?view=case-rooms&room=<key>` (a room alone opens it too). The overview has no query.
export function navFromQuery(view: string | null, room: string | null): Nav {
  if (room) return { view: "case-rooms", room };
  return view ? { view, room: null } : HOME;
}
export function navQuery(n: Nav) {
  const q = new URLSearchParams();
  if (n.view !== HOME.view) q.set("view", n.view);
  if (n.room) q.set("room", n.room);
  const s = q.toString();
  return s ? `?${s}` : "";
}
