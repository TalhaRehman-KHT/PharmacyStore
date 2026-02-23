import { supabase } from "../Config/supabase.js";

export async function getAlternative(req, res) {
    try {
        if (!supabase) return res.status(503).json({ message: "Supabase not configured" });

        const userId = req.user.id;
        const { query } = req.body;

        if (!query || typeof query !== "string") {
            return res.status(400).json({ message: "Query (medicine name) required" });
        }

        // TODO: Integrate with AI API (OpenAI, etc.) for real alternatives
        const mockAlternatives = [
            { name: "Alternative 1", salt: "Similar composition", manufacturer: "Generic" },
            { name: "Alternative 2", salt: "Similar composition", manufacturer: "Generic" },
        ];

        const { error } = await supabase.from("ai_alternatives").insert({
            user_id: userId,
            query: query.trim(),
            response: JSON.stringify(mockAlternatives),
        });

        if (error) return res.status(500).json({ message: "Failed to save query", error: error.message });

        return res.status(200).json({
            message: "Alternatives retrieved",
            query: query.trim(),
            alternatives: mockAlternatives,
        });
    } catch (err) {
        console.error("AI alternative error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}
