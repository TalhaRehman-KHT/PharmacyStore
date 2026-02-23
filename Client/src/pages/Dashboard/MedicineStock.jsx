import React, { useState, useEffect } from "react";
import { Package, Pill } from "lucide-react";
import axiosInstance from "../../api/axios.js";

export default function MedicineStock() {
    const [stock, setStock] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchStock = async () => {
            setLoading(true);
            setError("");
            try {
                const { data } = await axiosInstance.get("/api/vendor/stock");
                setStock(data.stock || []);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load stock");
            } finally {
                setLoading(false);
            }
        };
        fetchStock();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <h1 className="text-2xl font-semibold text-gray-800">
                    Medicine Stock
                </h1>
                <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
                    Loading stock...
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
                    <Package size={28} className="text-green-600" />
                    Medicine Stock
                </h1>
                <p className="text-gray-600 mt-1">
                    View and manage your medicine inventory
                </p>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {stock.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
                    <Pill size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-2">No medicines in stock</p>
                    <p className="text-sm text-gray-500">
                        Add medicines from the Add Medicine page
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {stock.map((item) => (
                        <div
                            key={item.id}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                        >
                            <div className="p-4 md:p-5 border-b border-gray-100">
                                <div className="flex items-start gap-3">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.medicine_name}
                                            className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                                            <Pill size={28} className="text-green-600" />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-gray-800">
                                            {item.medicine_name}
                                        </h3>
                                        {item.salt && (
                                            <p className="text-sm text-gray-600">
                                                {item.salt}
                                            </p>
                                        )}
                                        {item.manufacturer && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {item.manufacturer}
                                            </p>
                                        )}
                                        <p className="text-sm font-medium text-green-700 mt-1">
                                            Total Qty: {item.totalQuantity ?? 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-600">
                                            <th className="px-4 py-2 text-left">
                                                Batch
                                            </th>
                                            <th className="px-4 py-2 text-left">
                                                Qty
                                            </th>
                                            <th className="px-4 py-2 text-left">
                                                Mfg
                                            </th>
                                            <th className="px-4 py-2 text-left">
                                                Expiry
                                            </th>
                                            <th className="px-4 py-2 text-left">
                                                Price
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(item.batches || []).map((b) => (
                                            <tr
                                                key={b.id}
                                                className="border-t border-gray-100"
                                            >
                                                <td className="px-4 py-2">
                                                    {b.batch_number}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {b.quantity}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {new Date(
                                                        b.manufacture_date
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {new Date(
                                                        b.expiry_date
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-2">
                                                    Rs {b.selling_price}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
