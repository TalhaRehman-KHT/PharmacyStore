import React, { useState, useMemo, useEffect } from "react";
import VendorLayout from "../../components/VendorLayout.jsx";
import {
  PlusCircle,
  Pencil,
  Pill,
  Search,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  Layers,
  Calendar,
  MinusCircle,
  ImagePlus,
  Upload,
} from "lucide-react";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

const FILTERS = ["All", "Available", "Low Stock", "Expired"];

const statusConfig = {
  available: { color: "#008F0B", label: "Available" },
  low_stock: { color: "#FFC327", label: "Low Stock" },
  expired: { color: "#FF8F6B", label: "Expired" },
};

const sampleMedicines = [
  { id: "M001", name: "Paracetamol 500mg", category: "Pain Relief", quantity: 120, price: 5.99, status: "available", expiryDate: "2026-05-20" },
  { id: "M002", name: "Amoxicillin 250mg", category: "Antibiotics", quantity: 8, price: 12.5, status: "low_stock", expiryDate: "2025-12-01" },
  { id: "M003", name: "Ibuprofen 400mg", category: "Pain Relief", quantity: 200, price: 6.99, status: "available", expiryDate: "2026-08-15" },
  { id: "M004", name: "Omeprazole 20mg", category: "Digestive", quantity: 5, price: 9.99, status: "low_stock", expiryDate: "2025-11-10" },
  { id: "M005", name: "Loratadine 10mg", category: "Allergy", quantity: 85, price: 8.49, status: "available", expiryDate: "2026-03-22" },
  { id: "M006", name: "Metformin 500mg", category: "Diabetes", quantity: 45, price: 11.0, status: "available", expiryDate: "2025-09-05" },
  { id: "M007", name: "Aspirin 100mg", category: "Pain Relief", quantity: 0, price: 4.99, status: "expired", expiryDate: "2025-01-15" },
  { id: "M008", name: "Cetirizine 10mg", category: "Allergy", quantity: 32, price: 7.25, status: "available", expiryDate: "2026-07-30" },
];

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}18` }}
        >
          <Icon className="w-6 h-6 shrink-0" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
        </div>
      </div>
    </div>
  );
}

const emptyBatch = () => ({
  batchNumber: "",
  expiryDate: "",
  quantity: "",
  sellingPrice: "",
  purchasePrice: "",
});

export default function VendorMedicine() {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [detailMedicine, setDetailMedicine] = useState(null);

  // Add/Edit form state (same structure as my_fyp)
  const [medicineForm, setMedicineForm] = useState({
    name: "",
    genericName: "",
    strength: "",
    dosageForm: "",
    manufacturer: "",
    description: "",
  });
  const [batchEntries, setBatchEntries] = useState([emptyBatch()]);
  const [medicineImageFile, setMedicineImageFile] = useState(null);
  const [medicineImagePreview, setMedicineImagePreview] = useState(null);

  const filteredMedicines = useMemo(() => {
    let list = sampleMedicines;
    if (selectedFilter !== "All") {
      const statusKey = selectedFilter === "Low Stock" ? "low_stock" : selectedFilter === "Available" ? "available" : "expired";
      list = list.filter((m) => m.status === statusKey);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, selectedFilter]);

  const availableCount = sampleMedicines.filter((m) => m.status === "available").length;
  const lowStockCount = sampleMedicines.filter((m) => m.status === "low_stock").length;
  const expiredCount = sampleMedicines.filter((m) => m.status === "expired").length;

  const openAddModal = () => {
    setEditingMedicine(null);
    setMedicineForm({
      name: "",
      genericName: "",
      strength: "",
      dosageForm: "",
      manufacturer: "",
      description: "",
    });
    setBatchEntries([{ ...emptyBatch(), batchNumber: "1" }]);
    setMedicineImageFile(null);
    setMedicineImagePreview(null);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (!editingMedicine) return;
    setMedicineForm({
      name: editingMedicine.name ?? "",
      genericName: "",
      strength: "",
      dosageForm: editingMedicine.category ?? "",
      manufacturer: "",
      description: "",
    });
    setBatchEntries([
      {
        batchNumber: "1",
        expiryDate: editingMedicine.expiryDate ?? "",
        quantity: String(editingMedicine.quantity ?? ""),
        sellingPrice: String(editingMedicine.price ?? ""),
        purchasePrice: "",
      },
    ]);
    setMedicineImageFile(null);
    setMedicineImagePreview(editingMedicine.imageUrl ?? null);
  }, [editingMedicine]);

  const handleMedicineImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setMedicineImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setMedicineImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeMedicineImage = () => {
    setMedicineImageFile(null);
    setMedicineImagePreview(null);
  };

  const updateMedicineForm = (field, value) => {
    setMedicineForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateBatchEntry = (index, field, value) => {
    setBatchEntries((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  };

  const addBatchRow = () => {
    setBatchEntries((prev) => [...prev, { ...emptyBatch(), batchNumber: String(prev.length + 1) }]);
  };

  const removeBatchRow = (index) => {
    if (batchEntries.length <= 1) return;
    setBatchEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const showMedicineModal = showAddModal || !!editingMedicine;
  const closeMedicineModal = () => {
    setShowAddModal(false);
    setEditingMedicine(null);
  };

  return (
    <VendorLayout>
      <div className="min-h-full bg-[#f5f5f5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Page title */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Medicine Inventory</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {sampleMedicines.length} total medicines · Search and filter below
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard title="Available" value={availableCount} icon={CheckCircle} color="#008F0B" />
            <StatCard title="Low Stock" value={lowStockCount} icon={AlertTriangle} color="#FFC327" />
            <StatCard title="Expired" value={expiredCount} icon={XCircle} color="#FF8F6B" />
          </div>

          {/* Toolbar: filters left, search + Add at end */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => {
                  const isSelected = filter === selectedFilter;
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setSelectedFilter(filter)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-primary-green text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:ml-auto">
                <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Search by name or category..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                  />
                  {search.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-green text-white font-semibold rounded-xl hover:bg-dark-green transition-colors shrink-0"
                >
                  <PlusCircle className="w-5 h-5" />
                  Add Medicine
                </button>
              </div>
            </div>
          </div>

          {/* Medicine grid */}
          {filteredMedicines.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-gray-500">
              <Pill className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {sampleMedicines.length === 0 ? "No medicines yet" : "No medicines match your filter"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMedicines.map((med) => {
                const config = statusConfig[med.status] || statusConfig.available;
                return (
                  <div
                    key={med.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailMedicine(med)}
                    onKeyDown={(e) => e.key === "Enter" && setDetailMedicine(med)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div
                      className="relative w-full h-24 rounded-xl mb-3 flex items-center justify-center"
                      style={{ background: `${config.color}15` }}
                    >
                      <Pill className="w-12 h-12 shrink-0" style={{ color: config.color }} />
                      <span
                        className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: `${config.color}25`, color: config.color }}
                      >
                        {med.quantity}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 line-clamp-2">{med.name}</p>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 shrink-0" />
                      {med.category}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-base font-bold text-primary-green">
                        ${med.price.toFixed(2)}
                      </span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: config.color }}
                      />
                    </div>
                    <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setEditingMedicine(med)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-primary-green/40 rounded-xl text-primary-green text-xs font-semibold hover:bg-primary-green/10 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailMedicine(med)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-orange-50 text-primary-orange transition-colors"
                        aria-label="View details or delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Medicine modal (same as my_fyp) */}
      {showMedicineModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeMedicineModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">
                {editingMedicine ? "Edit Medicine" : "Add Medicine"}
              </h3>
              <button
                type="button"
                onClick={closeMedicineModal}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5">
              <p className="text-sm text-gray-500">
                {editingMedicine
                  ? "Edit medicine and batches on same screen."
                  : "Add medicine and batches (1, 2, 3...) on same screen."}
              </p>

              {/* Medicine image: add (Add) or update (Edit) */}
              <div>
                <label className={labelClass}>Medicine Image</label>
                {medicineImagePreview ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative w-32 h-32 rounded-2xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                      <img
                        src={medicineImagePreview}
                        alt="Medicine"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-green/50 text-primary-green text-sm font-medium cursor-pointer hover:bg-primary-green/10 transition-colors">
                        <Upload className="w-4 h-4" />
                        Change
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          onChange={handleMedicineImageChange}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={removeMedicineImage}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 cursor-pointer hover:border-primary-green/50 hover:bg-primary-green/5 transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleMedicineImageChange}
                    />
                    <ImagePlus className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-500">
                      {editingMedicine ? "Click to update image" : "Click to add image"}
                    </span>
                    <span className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</span>
                  </label>
                )}
              </div>

              {/* Medicine fields */}
              <div>
                <label className={labelClass}>Medicine Name *</label>
                <input
                  type="text"
                  value={medicineForm.name}
                  onChange={(e) => updateMedicineForm("name", e.target.value)}
                  placeholder="Enter medicine name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Generic Name</label>
                <input
                  type="text"
                  value={medicineForm.genericName}
                  onChange={(e) => updateMedicineForm("genericName", e.target.value)}
                  placeholder="Enter generic name (optional)"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Strength</label>
                  <input
                    type="text"
                    value={medicineForm.strength}
                    onChange={(e) => updateMedicineForm("strength", e.target.value)}
                    placeholder="e.g., 500mg"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Dosage Form</label>
                  <input
                    type="text"
                    value={medicineForm.dosageForm}
                    onChange={(e) => updateMedicineForm("dosageForm", e.target.value)}
                    placeholder="e.g., Tablet"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Manufacturer</label>
                <input
                  type="text"
                  value={medicineForm.manufacturer}
                  onChange={(e) => updateMedicineForm("manufacturer", e.target.value)}
                  placeholder="Enter manufacturer (optional)"
                  className={inputClass}
                />
              </div>

              {/* Batches section (like my_fyp) */}
              <div>
                <h4 className="text-base font-bold text-gray-900 mb-1">Batches</h4>
                <p className="text-sm text-gray-500 mb-3">
                  Add one or more batches with expiry, quantity and price for each.
                </p>
                <div className="space-y-4">
                  {batchEntries.map((batch, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-xl border border-primary-green/30 bg-primary-green/5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-primary-green">Batch {index + 1}</span>
                        {batchEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBatchRow(index)}
                            className="p-1 rounded-lg text-primary-orange hover:bg-orange-50 transition-colors"
                            aria-label="Remove batch"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Batch #</label>
                        <input
                          type="text"
                          value={batch.batchNumber}
                          onChange={(e) => updateBatchEntry(index, "batchNumber", e.target.value)}
                          placeholder="1, 2, 3..."
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Expiry date *</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="date"
                            value={batch.expiryDate}
                            onChange={(e) => updateBatchEntry(index, "expiryDate", e.target.value)}
                            className={inputClass + " pl-10"}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Quantity *</label>
                        <input
                          type="number"
                          min={0}
                          value={batch.quantity}
                          onChange={(e) => updateBatchEntry(index, "quantity", e.target.value)}
                          placeholder="Units"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Selling price *</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={batch.sellingPrice}
                          onChange={(e) => updateBatchEntry(index, "sellingPrice", e.target.value)}
                          placeholder="Per unit"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Purchase price (optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={batch.purchasePrice}
                          onChange={(e) => updateBatchEntry(index, "purchasePrice", e.target.value)}
                          placeholder="Cost"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addBatchRow}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-primary-green border-dashed text-primary-green font-semibold text-sm hover:bg-primary-green/10 transition-colors"
                >
                  <PlusCircle className="w-5 h-5" />
                  Add batch
                </button>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={medicineForm.description}
                  onChange={(e) => updateMedicineForm("description", e.target.value)}
                  placeholder="Enter description (optional)"
                  rows={3}
                  className={inputClass + " resize-none"}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
              <button
                type="button"
                onClick={closeMedicineModal}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={closeMedicineModal}
                className="px-5 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green transition-colors"
              >
                {editingMedicine ? "Update medicine & batches" : "Add medicine & batches"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detailMedicine && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDetailMedicine(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Medicine details</h3>
              <button
                type="button"
                onClick={() => setDetailMedicine(null)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-base font-bold text-gray-900">{detailMedicine.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{detailMedicine.category}</p>
              <div className="mt-4 p-4 bg-gray-50 rounded-xl flex justify-around gap-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{detailMedicine.quantity}</p>
                  <p className="text-xs text-gray-500">Stock</p>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-sm font-bold text-primary-green">${detailMedicine.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">Price</p>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">{detailMedicine.expiryDate}</p>
                  <p className="text-xs text-gray-500">Expiry</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setDetailMedicine(null); setEditingMedicine(detailMedicine); }}
                  className="flex-1 py-2.5 bg-primary-green text-white font-semibold rounded-xl text-sm hover:bg-dark-green transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDetailMedicine(null)}
                  className="flex-1 py-2.5 border border-primary-orange/50 text-primary-orange font-semibold rounded-xl text-sm hover:bg-orange-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
