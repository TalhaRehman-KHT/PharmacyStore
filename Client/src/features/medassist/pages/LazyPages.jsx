import { lazy, Suspense } from "react";

// MedAssist pages load on first visit, so their code (and react-markdown) stays out of the main bundle.
const UserAssistant = lazy(() => import("./UserAssistant.jsx"));
const VendorEscalations = lazy(() => import("./VendorEscalations.jsx"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function LazyUserAssistant() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <UserAssistant />
    </Suspense>
  );
}

export function LazyVendorEscalations() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <VendorEscalations />
    </Suspense>
  );
}
