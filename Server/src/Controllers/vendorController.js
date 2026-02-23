import bcrypt from "bcryptjs";
import { supabase } from "../Config/supabase.js";

export async function createStore(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const { shopName, city, address, contactNumber, licenseId, storePassword } = req.body;

        if (!shopName || !city || !address || !contactNumber || !licenseId || !storePassword) {
            return res.status(400).json({ message: "All fields required: shopName, city, address, contactNumber, licenseId, storePassword" });
        }

        const existing = await supabase.from("vendors").select("id").eq("user_id", userId).single();
        if (existing.data) return res.status(409).json({ message: "Store already exists for this account" });

        const storePasswordHash = await bcrypt.hash(storePassword, 12);

        const { data, error } = await supabase
            .from("vendors")
            .insert({
                user_id: userId,
                shop_name: shopName.trim(),
                city: city.trim(),
                address: address.trim(),
                contact_number: contactNumber.trim(),
                license_id: licenseId.trim(),
                store_password_hash: storePasswordHash,
            })
            .select("id, shop_name, city, address, contact_number, license_id, created_at")
            .single();

        if (error) {
            console.error("Create store Supabase error:", error);
            return res.status(500).json({
                message: "Failed to create store",
                error: error.message,
                hint: error.hint || (error.code === "42P01" ? "Run schema.sql in Supabase SQL Editor" : null),
            });
        }

        return res.status(201).json({ message: "Store created successfully", store: data });
    } catch (err) {
        console.error("Create store error:", err);
        return res.status(500).json({
            message: "Server error",
            error: err.message,
        });
    }
}

export async function addMedicine(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const { medicineName, salt, manufacturer, description, imageUrl } = req.body;

        if (!medicineName) return res.status(400).json({ message: "medicineName required" });

        const { data: store } = await supabase.from("vendors").select("id").eq("user_id", userId).single();
        if (!store) return res.status(403).json({ message: "Store not found. Create a store first." });

        const storeId = store.id;

        const { data, error } = await supabase
            .from("medicines")
            .insert({
                store_id: storeId,
                medicine_name: medicineName.trim(),
                salt: salt ? String(salt).trim() : null,
                manufacturer: manufacturer ? String(manufacturer).trim() : null,
                description: description ? String(description).trim() : null,
                image_url: imageUrl || null,
            })
            .select("id, medicine_name, salt, manufacturer, created_at")
            .single();

        if (error) return res.status(500).json({ message: "Failed to add medicine", error: error.message });

        return res.status(201).json({ message: "Medicine added", medicine: data });
    } catch (err) {
        console.error("Add medicine error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

export async function addBatch(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const { medicineId, batchNumber, quantity, manufactureDate, expiryDate, purchasePrice, sellingPrice } = req.body;

        if (!medicineId || !batchNumber || quantity == null || !manufactureDate || !expiryDate || purchasePrice == null || sellingPrice == null) {
            return res.status(400).json({ message: "medicineId, batchNumber, quantity, manufactureDate, expiryDate, purchasePrice, sellingPrice required" });
        }

        const medicine = await supabase.from("medicines").select("id, store_id").eq("id", medicineId).single();
        if (medicine.error || !medicine.data) return res.status(404).json({ message: "Medicine not found" });

        const store = await supabase.from("vendors").select("id").eq("id", medicine.data.store_id).eq("user_id", userId).single();
        if (!store.data) return res.status(403).json({ message: "Access denied" });

        const { data, error } = await supabase
            .from("batches")
            .insert({
                medicine_id: medicineId,
                batch_number: String(batchNumber).trim(),
                quantity: parseInt(quantity, 10),
                manufacture_date: manufactureDate,
                expiry_date: expiryDate,
                purchase_price: parseFloat(purchasePrice),
                selling_price: parseFloat(sellingPrice),
            })
            .select("id, batch_number, quantity, manufacture_date, expiry_date, purchase_price, selling_price, created_at")
            .single();

        if (error) return res.status(500).json({ message: "Failed to add batch", error: error.message });

        return res.status(201).json({ message: "Batch added", batch: data });
    } catch (err) {
        console.error("Add batch error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

export async function getStock(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;

        const { data: stores } = await supabase.from("vendors").select("id").eq("user_id", userId);
        const storeIds = (stores || []).map((s) => s.id);
        if (!storeIds.length) return res.status(200).json({ stock: [] });

        const { data: medicines } = await supabase
            .from("medicines")
            .select("id, medicine_name, salt, manufacturer, image_url, store_id")
            .in("store_id", storeIds);

        if (!medicines?.length) return res.status(200).json({ stock: [] });

        const medicineIds = medicines.map((m) => m.id);
        const { data: batches } = await supabase
            .from("batches")
            .select("id, medicine_id, batch_number, quantity, manufacture_date, expiry_date, purchase_price, selling_price")
            .in("medicine_id", medicineIds)
            .gt("quantity", 0);

        const stock = medicines.map((m) => ({
            ...m,
            batches: (batches || []).filter((b) => b.medicine_id === m.id),
            totalQuantity: (batches || [])
                .filter((b) => b.medicine_id === m.id)
                .reduce((sum, b) => sum + (b.quantity || 0), 0),
        }));

        return res.status(200).json({ stock });
    } catch (err) {
        console.error("Get stock error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

export async function getDashboardStats(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;

        const { data: stores } = await supabase.from("vendors").select("id").eq("user_id", userId);
        const storeIds = (stores || []).map((s) => s.id);
        if (!storeIds.length) {
            return res.status(200).json({
                totalMedicines: 0,
                lowStock: 0,
                expiringSoon: 0,
                totalSales: 0,
            });
        }

        const { data: medicines } = await supabase.from("medicines").select("id").in("store_id", storeIds);
        const medicineIds = (medicines || []).map((m) => m.id);

        const totalMedicines = medicines?.length ?? 0;

        let lowStock = 0;
        let expiringSoon = 0;
        let totalSales = 0;

        if (medicineIds.length) {
            const { data: batches } = await supabase
                .from("batches")
                .select("quantity, expiry_date, selling_price")
                .in("medicine_id", medicineIds);

            const thirtyDaysFromNow = new Date();
            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

            (batches || []).forEach((b) => {
                if (b.quantity != null && b.quantity <= 10) lowStock += 1;
                if (b.expiry_date && new Date(b.expiry_date) <= thirtyDaysFromNow) expiringSoon += 1;
                totalSales += (b.quantity || 0) * (parseFloat(b.selling_price) || 0);
            });
        }

        return res.status(200).json({
            totalMedicines,
            lowStock,
            expiringSoon,
            totalSales: Math.round(totalSales * 100) / 100,
        });
    } catch (err) {
        console.error("Dashboard stats error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}
