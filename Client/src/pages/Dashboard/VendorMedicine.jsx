import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import VendorLayout from "../../components/VendorLayout.jsx";
import VendorRouteGuard from "../../components/VendorRouteGuard.jsx";
import { useVendorDashboard } from "../../context/VendorDashboardContext.jsx";
import {
  getPharmacyMedicines,
  createMedicine,
  addMedicineBatch,
  updateMedicine,
  updateBatch,
  deleteBatch,
  deleteMedicine,
  batchStatus,
} from "../../lib/vendorMedicineService.js";
import { uploadMedicineImage } from "../../lib/vendorStorageService.js";
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
  Scan,
} from "lucide-react";
import { analyzeMedicineLabel } from "../../lib/geminiService.js";
import toast from "react-hot-toast";

const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green text-sm";
const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

const BATCH_FILTERS = ["All", "Available", "Low Stock", "Expired"];

const statusConfig = {
  available: { color: "#008F0B", label: "Available" },
  low_stock: { color: "#FFC327", label: "Low Stock" },
  expired: { color: "#FF8F6B", label: "Expired" },
  out_of_stock: { color: "#FF8F6B", label: "Out of stock" },
};

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
  const { pharmacy, refresh } = useVendorDashboard();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [detailMedicine, setDetailMedicine] = useState(null);
  const [detailBatchFilter, setDetailBatchFilter] = useState("All");
  const [saving, setSaving] = useState(false);

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
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!pharmacy?.id) return;
    setLoading(true);
    getPharmacyMedicines(pharmacy.id)
      .then(setMedicines)
      .catch(() => setMedicines([]))
      .finally(() => setLoading(false));
  }, [pharmacy?.id]);

  const groupedByMedicine = useMemo(() => {
    const byId = {};
    for (const batch of medicines) {
      const id = batch.medicineId;
      if (!byId[id]) {
        byId[id] = {
          medicineId: id,
          medicineName: batch.medicineName,
          dosageForm: batch.dosageForm,
          imageUrl: batch.imageUrl,
          batches: [],
        };
      }
      byId[id].batches.push(batch);
    }
    return Object.values(byId).map((g) => ({
      ...g,
      totalQuantity: g.batches.reduce((s, b) => s + (b.quantity || 0), 0),
      status: (() => {
        const hasExpired = g.batches.some((b) => batchStatus(b) === "expired" || batchStatus(b) === "out_of_stock");
        const hasLowStock = g.batches.some((b) => batchStatus(b) === "low_stock");
        if (hasExpired) return "expired";
        if (hasLowStock) return "low_stock";
        return "available";
      })(),
    }));
  }, [medicines]);

  const filteredMedicines = useMemo(() => {
    let list = groupedByMedicine;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.medicineName || "").toLowerCase().includes(q) ||
          (m.dosageForm || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [groupedByMedicine, search]);

  const availableCount = medicines.filter((m) => m.status === "available").length;
  const lowStockCount = medicines.filter((m) => m.status === "low_stock").length;
  const expiredCount = medicines.filter((m) => m.status === "expired").length;

  const openAddModal = () => {
    setEditingBatch(null);
    setMedicineForm({ name: "", genericName: "", strength: "", dosageForm: "", manufacturer: "", description: "" });
    setBatchEntries([{ ...emptyBatch(), batchNumber: "1" }]);
    setMedicineImageFile(null);
    setMedicineImagePreview(null);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (!editingBatch) return;
    setMedicineForm({
      name: editingBatch.medicineName ?? "",
      genericName: editingBatch.genericName ?? "",
      strength: editingBatch.strength ?? "",
      dosageForm: editingBatch.dosageForm ?? "",
      manufacturer: "",
      description: editingBatch.description ?? "",
    });
    setBatchEntries([
      {
        batchNumber: editingBatch.batchNumber ?? "1",
        expiryDate: editingBatch.expiryDate ? String(editingBatch.expiryDate).split("T")[0] : "",
        quantity: String(editingBatch.quantity ?? ""),
        sellingPrice: String(editingBatch.sellingPrice ?? ""),
        purchasePrice: editingBatch.purchasePrice != null ? String(editingBatch.purchasePrice) : "",
      },
    ]);
    setMedicineImageFile(null);
    setMedicineImagePreview(editingBatch.imageUrl ?? null);
  }, [editingBatch]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    setMedicineImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setMedicineImagePreview(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scanInputRef = React.useRef(null);
  const handleScanClick = () => {
    scanInputRef.current?.click();
  };
  const handleScanImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;
    e.target.value = "";
    setIsScanning(true);
    try {
      const result = await analyzeMedicineLabel(file);
      setMedicineForm((prev) => ({
        ...prev,
        name: result.name ?? prev.name,
        genericName: result.genericName ?? prev.genericName,
        strength: result.strength ?? prev.strength,
        dosageForm: result.dosageForm ?? prev.dosageForm,
        manufacturer: result.manufacturer ?? prev.manufacturer,
        description: result.description ?? prev.description,
      }));
      setMedicineImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setMedicineImagePreview(reader.result);
      reader.readAsDataURL(file);
      toast.success("Medicine details filled from scan. Review and save.");
    } catch (err) {
      toast.error(err?.message ?? "Could not scan label");
    } finally {
      setIsScanning(false);
    }
  };

  const updateForm = (field, value) => setMedicineForm((prev) => ({ ...prev, [field]: value }));
  const updateBatchEntry = (index, field, value) =>
    setBatchEntries((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  const addBatchRow = () =>
    setBatchEntries((prev) => [...prev, { ...emptyBatch(), batchNumber: String(prev.length + 1) }]);
  const removeBatchRow = (index) => {
    if (batchEntries.length <= 1) return;
    setBatchEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingBatch(null);
    setDetailMedicine(null);
    setDetailBatchFilter("All");
  };

  const handleSaveAdd = async () => {
    if (!pharmacy?.id || !medicineForm.name?.trim()) {
      toast.error("Medicine name is required.");
      return;
    }
    const validBatches = batchEntries.filter(
      (b) => b.expiryDate && b.quantity && parseFloat(b.sellingPrice) > 0
    );
    if (validBatches.length === 0) {
      toast.error("Add at least one batch with expiry, quantity and price.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = null;
      if (medicineImageFile) {
        try {
          const tempId = `temp-${Date.now()}`;
          imageUrl = await uploadMedicineImage(medicineImageFile, tempId);
        } catch (e) {
          console.warn("Image upload failed:", e);
        }
      }
      const med = await createMedicine({
        name: medicineForm.name.trim(),
        genericName: medicineForm.genericName?.trim() || null,
        strength: medicineForm.strength?.trim() || null,
        dosageForm: medicineForm.dosageForm?.trim() || null,
        manufacturer: medicineForm.manufacturer?.trim() || null,
        description: medicineForm.description?.trim() || null,
        imageUrl,
      });
      for (const b of validBatches) {
        await addMedicineBatch({
          pharmacyId: pharmacy.id,
          medicineId: med.id,
          batchNumber: b.batchNumber || "1",
          expiryDate: b.expiryDate,
          quantity: parseInt(b.quantity, 10) || 0,
          purchasePrice: b.purchasePrice ? parseFloat(b.purchasePrice) : null,
          sellingPrice: parseFloat(b.sellingPrice),
        });
      }
      toast.success("Medicine and batches added.");
      closeModal();
      getPharmacyMedicines(pharmacy.id).then(setMedicines);
      refresh();
    } catch (e) {
      toast.error(e?.message || "Failed to add medicine");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingBatch || !pharmacy?.id) return;
    const b = batchEntries[0];
    if (!b?.expiryDate || !b.quantity || !b.sellingPrice) {
      toast.error("Expiry, quantity and price are required.");
      return;
    }
    setSaving(true);
    try {
      await updateMedicine(editingBatch.medicineId, {
        name: medicineForm.name?.trim() || editingBatch.medicineName,
        genericName: medicineForm.genericName?.trim() || null,
        strength: medicineForm.strength?.trim() || null,
        dosageForm: medicineForm.dosageForm?.trim() || null,
        manufacturer: medicineForm.manufacturer?.trim() || null,
        description: medicineForm.description?.trim() || null,
      });
      await updateBatch(editingBatch.id, {
        batchNumber: b.batchNumber || editingBatch.batchNumber,
        expiryDate: b.expiryDate,
        quantity: parseInt(b.quantity, 10) || 0,
        purchasePrice: b.purchasePrice ? parseFloat(b.purchasePrice) : null,
        sellingPrice: parseFloat(b.sellingPrice),
      });
      toast.success("Medicine updated.");
      closeModal();
      getPharmacyMedicines(pharmacy.id).then(setMedicines);
      refresh();
    } catch (e) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBatch = async (batch) => {
    if (!batch || !pharmacy?.id) return;
    if (!confirm("Delete this batch? This cannot be undone.")) return;
    setSaving(true);
    try {
      await deleteBatch(batch.id);
      toast.success("Batch deleted.");
      if (detailMedicine) {
        const updated = detailMedicine.batches.filter((b) => b.id !== batch.id);
        if (updated.length === 0) closeModal();
        else setDetailMedicine({ ...detailMedicine, batches: updated });
      }
      getPharmacyMedicines(pharmacy.id).then(setMedicines);
      refresh();
    } catch (e) {
      toast.error(e?.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorRouteGuard>
      <VendorLayout>
        <div className="min-h-full bg-[#f5f5f5]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Medicine Inventory</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {loading ? "Loading…" : `${groupedByMedicine.length} medicines · Tap one to view and filter batches`}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <StatCard title="Available" value={availableCount} icon={CheckCircle} color="#008F0B" />
              <StatCard title="Low Stock" value={lowStockCount} icon={AlertTriangle} color="#FFC327" />
              <StatCard title="Expired" value={expiredCount} icon={XCircle} color="#FF8F6B" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/vendor/expiring-soon"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-primary-green/50 text-primary-green font-semibold text-sm hover:bg-primary-green/10 transition-colors shrink-0"
                  >
                    <Calendar className="w-5 h-5" />
                    View expiring soon
                  </Link>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:ml-auto">
                  <div className="relative w-full sm:w-auto sm:min-w-[220px] sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search by name or category..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-green/20 focus:border-primary-green"
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-green text-white font-semibold rounded-xl hover:bg-dark-green shrink-0"
                  >
                    <PlusCircle className="w-5 h-5" />
                    Add Medicine
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-green border-t-transparent" />
              </div>
            ) : filteredMedicines.length === 0 ? (
              <div className="bg-white rounded-2xl border flex flex-col items-center justify-center py-16 text-gray-500">
                <Pill className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">
                  {groupedByMedicine.length === 0 ? "No medicines yet" : "No medicines match your search"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredMedicines.map((m) => {
                  const cfg = statusConfig[m.status] || statusConfig.available;
                  return (
                    <div
                      key={m.medicineId}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setDetailMedicine(m)}
                    >
                      <div
                        className="relative w-full h-24 rounded-xl mb-3 flex items-center justify-center"
                        style={{ background: `${cfg.color}15` }}
                      >
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt=""
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <Pill className="w-12 h-12 shrink-0" style={{ color: cfg.color }} />
                        )}
                        <span
                          className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: `${cfg.color}25`, color: cfg.color }}
                        >
                          {m.totalQuantity}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 line-clamp-2">{m.medicineName || "Medicine"}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Layers className="w-3 h-3 shrink-0" />
                        {m.dosageForm || "—"}
                      </p>
                      <div className="flex items-center justify-between mt-3">
                        <span
                          className="px-2 py-0.5 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: `${cfg.color}25`, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit modal */}
        {(showAddModal || editingBatch) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingBatch ? "Edit Medicine" : "Add Medicine"}
                </h3>
                <button type="button" onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-6 space-y-5">
                {!editingBatch && (
                  <div>
                    <input
                      ref={scanInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={handleScanImageChange}
                    />
                    <button
                      type="button"
                      onClick={handleScanClick}
                      disabled={isScanning}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary-green/50 bg-primary-green/5 text-primary-green font-semibold text-sm hover:bg-primary-green/10 transition-colors disabled:opacity-60"
                    >
                      {isScanning ? (
                        <>
                          <div className="w-5 h-5 border-2 border-primary-green border-t-transparent rounded-full animate-spin" />
                          Scanning…
                        </>
                      ) : (
                        <>
                          <Scan className="w-5 h-5" />
                          Scan medicine label
                        </>
                      )}
                    </button>
                    <p className="text-xs text-text-secondary text-center mt-1.5">
                      Take a photo or choose from gallery. AI will extract medicine details.
                    </p>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Medicine Image</label>
                  {medicineImagePreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-32 h-32 rounded-2xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                        <img src={medicineImagePreview} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-primary-green/50 text-primary-green text-sm font-medium cursor-pointer hover:bg-primary-green/10">
                          <Upload className="w-4 h-4" />
                          Change
                          <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                        </label>
                        <button
                          type="button"
                          onClick={() => { setMedicineImageFile(null); setMedicineImagePreview(null); }}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-100"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/80 cursor-pointer hover:border-primary-green/50">
                      <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                      <ImagePlus className="w-10 h-10 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-500">Click to add image</span>
                    </label>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Medicine Name *</label>
                  <input
                    type="text"
                    value={medicineForm.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                    placeholder="Enter medicine name"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Strength</label>
                    <input
                      type="text"
                      value={medicineForm.strength}
                      onChange={(e) => updateForm("strength", e.target.value)}
                      placeholder="e.g. 500mg"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Dosage Form</label>
                    <input
                      type="text"
                      value={medicineForm.dosageForm}
                      onChange={(e) => updateForm("dosageForm", e.target.value)}
                      placeholder="e.g. Tablet"
                      className={inputClass}
                    />
                  </div>
                </div>

                {editingBatch ? (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Batch</h4>
                    {batchEntries.map((b, i) => (
                      <div key={i} className="p-4 rounded-xl border border-primary-green/30 bg-primary-green/5 space-y-3">
                        <div>
                          <label className={labelClass}>Expiry date *</label>
                          <input
                            type="date"
                            value={b.expiryDate}
                            onChange={(e) => updateBatchEntry(i, "expiryDate", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Quantity *</label>
                          <input
                            type="number"
                            min={0}
                            value={b.quantity}
                            onChange={(e) => updateBatchEntry(i, "quantity", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Selling price *</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={b.sellingPrice}
                            onChange={(e) => updateBatchEntry(i, "sellingPrice", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-2">Batches</h4>
                    {batchEntries.map((b, i) => (
                      <div key={i} className="p-4 rounded-xl border border-primary-green/30 bg-primary-green/5 space-y-3 mb-3">
                        <div className="flex justify-between">
                          <span className="text-sm font-bold text-primary-green">Batch {i + 1}</span>
                          {batchEntries.length > 1 && (
                            <button type="button" onClick={() => removeBatchRow(i)} className="text-primary-orange hover:bg-orange-50 p-1 rounded">
                              <MinusCircle className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                        <div>
                          <label className={labelClass}>Expiry date *</label>
                          <input
                            type="date"
                            value={b.expiryDate}
                            onChange={(e) => updateBatchEntry(i, "expiryDate", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Quantity *</label>
                          <input
                            type="number"
                            min={0}
                            value={b.quantity}
                            onChange={(e) => updateBatchEntry(i, "quantity", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Selling price *</label>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={b.sellingPrice}
                            onChange={(e) => updateBatchEntry(i, "sellingPrice", e.target.value)}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addBatchRow}
                      className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary-green text-primary-green font-semibold text-sm hover:bg-primary-green/10"
                    >
                      <PlusCircle className="w-5 h-5" />
                      Add batch
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50/50 shrink-0">
                <button type="button" onClick={closeModal} className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingBatch ? handleSaveEdit : handleSaveAdd}
                  disabled={saving}
                  className="px-5 py-2.5 bg-primary-green text-white rounded-xl font-medium text-sm hover:bg-dark-green disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingBatch ? "Update" : "Add medicine & batches"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detail modal: medicine group with batch filter */}
        {detailMedicine && !showAddModal && !editingBatch && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setDetailMedicine(null)}
          >
            <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                <h3 className="text-lg font-bold text-gray-900">Batches</h3>
                <button type="button" onClick={() => setDetailMedicine(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 pt-4 pb-2 shrink-0">
                <p className="text-base font-bold text-gray-900">{detailMedicine.medicineName || "Medicine"}</p>
                <p className="text-sm text-gray-500 mt-0.5">{detailMedicine.dosageForm || "—"}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {BATCH_FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDetailBatchFilter(f)}
                      className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-medium ${
                        detailBatchFilter === f ? "bg-primary-green text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-y-auto px-6 pb-6 flex-1 min-h-0">
                {(() => {
                  const statusKey = detailBatchFilter === "Low Stock" ? "low_stock" : detailBatchFilter === "Available" ? "available" : detailBatchFilter === "Expired" ? "expired" : null;
                  const filteredBatches = statusKey
                    ? detailMedicine.batches.filter((b) => {
                        const s = batchStatus(b);
                        if (detailBatchFilter === "Expired") return s === "expired" || s === "out_of_stock";
                        return s === statusKey;
                      })
                    : detailMedicine.batches;
                  return filteredBatches.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No batches match this filter.</p>
                  ) : (
                    <ul className="space-y-3">
                      {filteredBatches.map((batch) => {
                        const s = batchStatus(batch);
                        const cfg = statusConfig[s] || statusConfig.available;
                        return (
                          <li
                            key={batch.id}
                            className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">Batch {batch.batchNumber ?? "—"}</p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                Qty: {batch.quantity ?? 0} · ${(batch.sellingPrice ?? 0).toFixed(2)} · Exp: {batch.expiryDate ? String(batch.expiryDate).split("T")[0] : "—"}
                              </p>
                            </div>
                            <span
                              className="px-2 py-0.5 rounded-lg text-xs font-bold shrink-0"
                              style={{ backgroundColor: `${cfg.color}25`, color: cfg.color }}
                            >
                              {cfg.label}
                            </span>
                            <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => { setDetailMedicine(null); setEditingBatch(batch); setShowAddModal(true); }}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 border border-primary-green/40 rounded-xl text-primary-green text-xs font-semibold hover:bg-primary-green/10"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBatch(batch)}
                                disabled={saving}
                                className="flex items-center justify-center gap-1.5 py-2 px-3 border border-primary-orange/50 rounded-xl text-primary-orange text-xs font-semibold hover:bg-orange-50 disabled:opacity-60"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </VendorLayout>
    </VendorRouteGuard>
  );
}
