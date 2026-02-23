import React, { useContext } from "react";
import { AuthContext } from "../../context/AuthContext.jsx";
import { Pill, AlertTriangle, CalendarClock, DollarSign } from "lucide-react";

export default function Dashboard() {
    const { user } = useContext(AuthContext);
    const displayName = user?.user?.name || user?.user?.email || "Vendor";

    const stats = [
        {
            label: "Total Medicines",
            value: "0",
            icon: Pill,
            color: "bg-emerald-50 text-emerald-600",
            borderColor: "border-emerald-200",
        },
        {
            label: "Low Stock",
            value: "0",
            icon: AlertTriangle,
            color: "bg-amber-50 text-amber-600",
            borderColor: "border-amber-200",
        },
        {
            label: "Expiring Soon",
            value: "0",
            icon: CalendarClock,
            color: "bg-rose-50 text-rose-600",
            borderColor: "border-rose-200",
        },
        {
            label: "Total Sales",
            value: "Rs 0",
            icon: DollarSign,
            color: "bg-teal-50 text-teal-600",
            borderColor: "border-teal-200",
        },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-800">
                    Welcome, {displayName}
                </h1>
                <p className="text-gray-600 mt-1">
                    Overview of your pharmacy store
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.label}
                            className={`rounded-xl border ${stat.borderColor} bg-white p-5 shadow-sm hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">
                                        {stat.label}
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-gray-800">
                                        {stat.value}
                                    </p>
                                </div>
                                <div
                                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
                                >
                                    <Icon size={24} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
