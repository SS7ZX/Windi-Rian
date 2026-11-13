import { lazy, Suspense, useEffect } from "react";

const AdminApp = lazy(() => import("./admin/AdminApp"));
const InvitationApp = lazy(() => import("./App"));

export default function Root() {
  const isAdmin = window.location.pathname.replace(/\/+$/, "") === "/admin";
  useEffect(() => {
    document.body.classList.toggle("admin-body", isAdmin);
    document.body.classList.toggle("lock", !isAdmin);
    return () => document.body.classList.remove("admin-body");
  }, [isAdmin]);

  const Page = isAdmin ? AdminApp : InvitationApp;
  return <Suspense fallback={<main className={isAdmin ? "admin-loading-screen" : ""}>Memuat...</main>}><Page /></Suspense>;
}
