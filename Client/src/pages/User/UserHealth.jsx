import React from "react";
import { Link } from "react-router-dom";
import UserLayout from "../../components/UserLayout.jsx";
import { Barcode, RefreshCw, Bell, ChevronRight } from "lucide-react";

const features = [
  {
    title: "Scan Prescription",
    subtitle: "Upload & AI reads it in simple language",
    icon: Barcode,
    color: "#008F0B",
    href: null,
    comingSoon: true,
  },
  {
    title: "Medicine Alternatives",
    subtitle: "AI suggests cheaper or better options",
    icon: RefreshCw,
    color: "#008F0B",
    href: null,
    comingSoon: true,
  },
  {
    title: "Medicine Reminders",
    subtitle: "Never miss a dose with smart alerts",
    icon: Bell,
    color: "#008F0B",
    href: null,
    comingSoon: true,
  },
];

function FeatureCard({ title, subtitle, icon: Icon, color, href, comingSoon }) {
  const content = (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-[0_4px_10px_var(--color-card-shadow)] transition-shadow hover:shadow-md ${!comingSoon && href ? "cursor-pointer" : ""}`}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {comingSoon && (
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
          Coming soon
        </span>
      )}
      {!comingSoon && href && <ChevronRight className="w-5 h-5 text-primary-green shrink-0" />}
    </div>
  );

  if (href && !comingSoon) {
    return <Link to={href}>{content}</Link>;
  }
  return content;
}

export default function UserHealth() {
  return (
    <UserLayout>
      <div className="px-4 sm:px-6 py-4 max-w-7xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Health</h2>

        <p className="text-base font-bold text-gray-900 mb-2">Prescription Tools</p>
        <div className="space-y-2 mb-5">
          {features.slice(0, 2).map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        <p className="text-base font-bold text-gray-900 mb-2">Personal Health Support</p>
        <div className="space-y-2">
          {features.slice(2).map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </UserLayout>
  );
}
