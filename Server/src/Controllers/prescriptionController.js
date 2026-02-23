import { supabase } from "../Config/supabase.js";
import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /image\/(jpeg|jpg|png|gif|webp)/;
        if (allowed.test(file.mimetype)) cb(null, true);
        else cb(new Error("Only images allowed (JPEG, PNG, GIF, WebP)"));
    },
}).single("image");

export function uploadMiddleware(req, res, next) {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message || "Upload failed" });
        next();
    });
}

export async function uploadPrescription(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const file = req.file;

        if (!file) return res.status(400).json({ message: "Image file required" });

        const ext = path.extname(file.originalname) || ".jpg";
        const fileName = `${userId}/${crypto.randomUUID()}${ext}`;

        const { error: uploadErr } = await supabase.storage
            .from("prescriptions")
            .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });

        if (uploadErr) {
            return res.status(500).json({ message: "Failed to upload image", error: uploadErr.message });
        }

        const { data: urlData } = supabase.storage.from("prescriptions").getPublicUrl(fileName);
        const imageUrl = urlData?.publicUrl || fileName;

        const { data, error } = await supabase
            .from("prescriptions")
            .insert({ user_id: userId, image_url: imageUrl })
            .select("id, image_url, created_at")
            .single();

        if (error) return res.status(500).json({ message: "Failed to save prescription", error: error.message });

        return res.status(201).json({ message: "Prescription uploaded", prescription: data });
    } catch (err) {
        console.error("Prescription upload error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}
