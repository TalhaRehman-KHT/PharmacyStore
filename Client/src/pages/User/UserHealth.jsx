import React from "react";
import { Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { Barcode, RefreshCw, Bell, ChevronRight } from "lucide-react";

const PRESCRIPTION_FEATURES = [
  {
    title: "Scan Prescription",
    subtitle: "Upload & AI reads it in simple language",
    icon: Barcode,
    color: "#008F0B",
    href: "/user/health/scan-prescription",
  },
  {
    title: "Medicine Alternatives",
    subtitle: "Enter name → AI shows details & alternatives",
    icon: RefreshCw,
    color: "#008F0B",
    href: "/user/health/alternatives",
  },
];

const HEALTH_FEATURES = [
  {
    title: "Medicine Reminders",
    subtitle: "Never miss a dose with smart alerts",
    icon: Bell,
    color: "#008F0B",
    href: "/user/health/reminders",
  },
];

function FeatureCard({ title, subtitle, icon: Icon, color, href }) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-green/20 transition-all duration-200"
    >
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-8 h-8" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-lg">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <ChevronRight className="w-6 h-6 text-primary-green shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

export default function UserHealth() {
  return (
    <UserLayout>
      <div className="min-h-full bg-gray-50/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <header className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Health</h1>
            <p className="text-gray-500 mt-1">Prescription tools and medicine reminders</p>
          </header>

          <section className="mb-10">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Prescription Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESCRIPTION_FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Personal Health Support</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              {HEALTH_FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </UserLayout>
  );
}
