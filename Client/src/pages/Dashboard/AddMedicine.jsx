import React, { useState } from "react";
import { Pill, Upload, Package } from "lucide-react";

const inputClass =
    "w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent";

export default function AddMedicine() {
    const [step, setStep] = useState(1);
    const [medicine, setMedicine] = useState({
        medicineName: "",
        salt: "",
        manufacturer: "",
        description: "",
        image: null,
    });
    const [batch, setBatch] = useState({
        batchNumber: "",
        quantity: "",
        manufactureDate: "",
        expiryDate: "",
        purchasePrice: "",
        sellingPrice: "",
    });
    const [imagePreview, setImagePreview] = useState(null);

    const handleMedicineChange = (e) => {
        const { name, value } = e.target;
        setMedicine((prev) => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setMedicine((prev) => ({ ...prev, image: file }));
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleBatchChange = (e) => {
        const { name, value } = e.target;
        setBatch((prev) => ({ ...prev, [name]: value }));
    };

    const handleMedicineSubmit = (e) => {
        e.preventDefault();
        setStep(2);
    };

    const handleBatchSubmit = (e) => {
        e.preventDefault();
        // No backend - could show success message or reset
        alert("Medicine and batch added successfully!");
    };

    const handleAddAnotherBatch = () => {
        setBatch({
            batchNumber: "",
            quantity: "",
            manufactureDate: "",
            expiryDate: "",
            purchasePrice: "",
            sellingPrice: "",
        });
        setStep(2);
    };

    const handleAddAnotherMedicine = () => {
        setMedicine({
            medicineName: "",
            salt: "",
            manufacturer: "",
            description: "",
            image: null,
        });
        setBatch({
            batchNumber: "",
            quantity: "",
            manufactureDate: "",
            expiryDate: "",
            purchasePrice: "",
            sellingPrice: "",
        });
        setImagePreview(null);
        setStep(1);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-gray-800">Add Medicine</h1>
                <p className="text-gray-600 mt-1">Add new medicine to your inventory</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                        step === 1 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                >
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                            step === 1 ? "bg-green-600 text-white" : "bg-gray-300 text-gray-600"
                        }`}
                    >
                        1
                    </span>
                    Medicine Details
                </div>
                <div className="h-px flex-1 bg-gray-200" />
                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                        step === 2 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                >
                    <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                            step === 2 ? "bg-green-600 text-white" : "bg-gray-300 text-gray-600"
                        }`}
                    >
                        2
                    </span>
                    Batch Info
                </div>
            </div>

            {step === 1 ? (
                <form
                    onSubmit={handleMedicineSubmit}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                    <div className="p-4 md:p-6 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                                <Pill size={22} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-800">Medicine Details</h2>
                                <p className="text-sm text-gray-500">Enter basic medicine information</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 space-y-4">
                        <div>
                            <label htmlFor="medicineName" className="block text-sm font-medium text-gray-700 mb-1">
                                Medicine Name
                            </label>
                            <input
                                id="medicineName"
                                type="text"
                                name="medicineName"
                                placeholder="e.g. Paracetamol"
                                value={medicine.medicineName}
                                onChange={handleMedicineChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="salt" className="block text-sm font-medium text-gray-700 mb-1">
                                Salt
                            </label>
                            <input
                                id="salt"
                                type="text"
                                name="salt"
                                placeholder="e.g. Paracetamol 500mg"
                                value={medicine.salt}
                                onChange={handleMedicineChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 mb-1">
                                Manufacturer
                            </label>
                            <input
                                id="manufacturer"
                                type="text"
                                name="manufacturer"
                                placeholder="e.g. GlaxoSmithKline"
                                value={medicine.manufacturer}
                                onChange={handleMedicineChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                rows={3}
                                placeholder="Brief description of the medicine..."
                                value={medicine.description}
                                onChange={handleMedicineChange}
                                className={`${inputClass} resize-none`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Image Upload
                            </label>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-8 px-4 hover:bg-gray-100 hover:border-green-400 transition-colors">
                                    <Upload size={32} className="text-gray-400 mb-2" />
                                    <span className="text-sm text-gray-600 text-center">
                                        Click to upload or drag and drop
                                    </span>
                                    <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageChange}
                                    />
                                </label>
                                {imagePreview && (
                                    <div className="w-full sm:w-32 h-32 shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50">
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                            Continue to Batch
                        </button>
                    </div>
                </form>
            ) : (
                <form
                    onSubmit={handleBatchSubmit}
                    className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                    <div className="p-4 md:p-6 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                                <Package size={22} />
                            </div>
                            <div>
                                <h2 className="font-semibold text-gray-800">Batch Information</h2>
                                <p className="text-sm text-gray-500">
                                    Add batch details for {medicine.medicineName || "this medicine"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="batchNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                Batch Number
                            </label>
                            <input
                                id="batchNumber"
                                type="text"
                                name="batchNumber"
                                placeholder="e.g. B2024001"
                                value={batch.batchNumber}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                                Quantity
                            </label>
                            <input
                                id="quantity"
                                type="number"
                                name="quantity"
                                min="1"
                                placeholder="Number of units"
                                value={batch.quantity}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="manufactureDate" className="block text-sm font-medium text-gray-700 mb-1">
                                Manufacture Date
                            </label>
                            <input
                                id="manufactureDate"
                                type="date"
                                name="manufactureDate"
                                value={batch.manufactureDate}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="expiryDate" className="block text-sm font-medium text-gray-700 mb-1">
                                Expiry Date
                            </label>
                            <input
                                id="expiryDate"
                                type="date"
                                name="expiryDate"
                                value={batch.expiryDate}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="purchasePrice" className="block text-sm font-medium text-gray-700 mb-1">
                                Purchase Price (Rs)
                            </label>
                            <input
                                id="purchasePrice"
                                type="number"
                                name="purchasePrice"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={batch.purchasePrice}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="sellingPrice" className="block text-sm font-medium text-gray-700 mb-1">
                                Selling Price (Rs)
                            </label>
                            <input
                                id="sellingPrice"
                                type="number"
                                name="sellingPrice"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={batch.sellingPrice}
                                onChange={handleBatchChange}
                                className={inputClass}
                                required
                            />
                        </div>
                    </div>

                    <div className="p-4 md:p-6 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={handleAddAnotherBatch}
                            className="px-6 py-3 border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors"
                        >
                            Add Another Batch
                        </button>
                        <button
                            type="submit"
                            className="flex-1 sm:flex-initial px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                        >
                            Save & Finish
                        </button>
                    </div>
                </form>
            )}

            {step === 2 && (
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={handleAddAnotherMedicine}
                        className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline"
                    >
                        Add a different medicine
                    </button>
                </div>
            )}
        </div>
    );
}
