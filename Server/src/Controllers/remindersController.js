import { supabase } from "../Config/supabase.js";

export async function getReminders(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;

        const { data, error } = await supabase
            .from("reminders")
            .select("*")
            .eq("user_id", userId)
            .order("reminder_date", { ascending: true });

        if (error) {
            console.error("Get reminders Supabase error:", error);
            const hint = error.code === "42703"
                ? "Run fix_reminders_table.sql in Supabase SQL Editor (see Server/src/database/)"
                : (error.hint || (error.details?.includes("Perhaps you meant") ? error.details : null));
            return res.status(500).json({
                message: "Failed to fetch reminders",
                error: error.message,
                hint,
            });
        }

        const reminders = (data || []).map((r) => ({
            ...r,
            title: r.title || r.name || r.reminder_name || "",
        }));
        return res.status(200).json({ reminders });
    } catch (err) {
        console.error("Get reminders error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

export async function createReminder(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const { title, description, reminder_date } = req.body;

        if (!title || !reminder_date) {
            return res.status(400).json({ message: "Title and reminder_date required" });
        }

        const { data, error } = await supabase
            .from("reminders")
            .insert({
                user_id: userId,
                title: String(title).trim(),
                description: description ? String(description).trim() : null,
                reminder_date: new Date(reminder_date).toISOString(),
            })
            .select("*")
            .single();

        if (error) {
            console.error("Create reminder Supabase error:", error);
            const hint = error.code === "42703"
                ? "Run fix_reminders_table.sql in Supabase SQL Editor (see Server/src/database/)"
                : (error.hint || (error.details?.includes("Perhaps you meant") ? error.details : null));
            return res.status(500).json({
                message: "Failed to create reminder",
                error: error.message,
                hint,
            });
        }

        const reminder = { ...data, title: data?.title || data?.name || data?.reminder_name || "" };
        return res.status(201).json({ message: "Reminder created", reminder });
    } catch (err) {
        console.error("Create reminder error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}
