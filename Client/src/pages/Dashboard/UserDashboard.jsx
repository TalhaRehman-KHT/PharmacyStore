import React, { useState, useRef, useEffect } from "react";
import { Camera, Upload, Search } from "lucide-react";
import axiosInstance from "../../api/axios.js";

export default function UserDashboard() {
    const [messages, setMessages] = useState([
        { id: 1, text: "Hi! How can I help you today? Upload a prescription or search for medicine alternatives.", isBot: true },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [prescriptionModalOpen, setPrescriptionModalOpen] = useState(false);
    const [alternativeModalOpen, setAlternativeModalOpen] = useState(false);
    const [medicineName, setMedicineName] = useState("");
    const [uploadedFile, setUploadedFile] = useState(null);
    const [prescriptionLoading, setPrescriptionLoading] = useState(false);
    const [alternativeLoading, setAlternativeLoading] = useState(false);
    const [error, setError] = useState("");
    const chatEndRef = useRef(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = (e) => {
        e?.preventDefault();
        if (!inputValue.trim()) return;
        setMessages((prev) => [
            ...prev,
            { id: Date.now(), text: inputValue.trim(), isBot: false },
        ]);
        setInputValue("");
    };

    const handlePrescriptionSubmit = async (e) => {
        e.preventDefault();
        if (!uploadedFile) return;
        setPrescriptionLoading(true);
        setError("");
        try {
            const formData = new FormData();
            formData.append("image", uploadedFile);
            const { data } = await axiosInstance.post("/api/prescription/upload", formData);
            setMessages((prev) => [
                ...prev,
                { id: Date.now(), text: `Prescription uploaded: ${uploadedFile.name}`, isBot: false },
                { id: Date.now() + 1, text: "Prescription uploaded successfully! You can view it in your records.", isBot: true },
            ]);
            setUploadedFile(null);
            setPrescriptionModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to upload prescription");
        } finally {
            setPrescriptionLoading(false);
        }
    };

    const handleAlternativeSubmit = async (e) => {
        e.preventDefault();
        const query = medicineName.trim();
        if (!query) return;
        setAlternativeLoading(true);
        setError("");
        try {
            const { data } = await axiosInstance.post("/api/ai/alternative", { query });
            const altList = (data.alternatives || []).map((a) => `${a.name} (${a.salt || "N/A"}) - ${a.manufacturer || "Generic"}`).join(", ");
            setMessages((prev) => [
                ...prev,
                { id: Date.now(), text: `Looking for alternatives to: ${query}`, isBot: false },
                {
                    id: Date.now() + 1,
                    text: altList ? `Alternatives: ${altList}` : "No alternatives found.",
                    isBot: true,
                },
            ]);
            setMedicineName("");
            setAlternativeModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to get alternatives");
        } finally {
            setAlternativeLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[400px]">
            {/* Chat Section */}
            <div className="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.isBot ? "justify-start" : "justify-end"}`}
                        >
                            <div
                                className={`max-w-[85%] sm:max-w-[75%] rounded-lg px-4 py-2.5 ${
                                    msg.isBot
                                        ? "bg-gray-100 text-gray-800"
                                        : "bg-green-600 text-white"
                                }`}
                            >
                                <p className="text-sm sm:text-base">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    <div ref={chatEndRef} />
                </div>

                <form
                    onSubmit={handleSend}
                    className="flex gap-2 p-4 border-t border-gray-200"
                >
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-4 py-2.5 text-white hover:bg-green-700 transition-colors shrink-0"
                    >
                        Send
                    </button>
                </form>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        setPrescriptionModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 bg-white px-4 py-3 text-green-600 hover:bg-green-50 transition-colors font-medium"
                >
                    <Upload size={20} />
                    Upload Prescription
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        setAlternativeModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 bg-white px-4 py-3 text-green-600 hover:bg-green-50 transition-colors font-medium"
                >
                    <Search size={20} />
                    Find Medicine Alternative
                </button>
            </div>

            {/* Upload Prescription Modal */}
            {prescriptionModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                            <h3 className="font-semibold text-gray-800">
                                Upload Prescription
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrescriptionModalOpen(false);
                                    setUploadedFile(null);
                                }}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handlePrescriptionSubmit} className="p-4">
                            {error && (
                                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-3">
                                <label className="flex flex-col gap-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        Choose image
                                    </span>
                                    <div className="flex gap-2">
                                        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-4 px-3 hover:bg-gray-100 transition-colors">
                                            <Camera size={24} className="text-gray-500" />
                                            <span className="text-sm text-gray-600">
                                                Camera
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                className="hidden"
                                                onChange={(e) =>
                                                    setUploadedFile(e.target.files?.[0])
                                                }
                                            />
                                        </label>
                                        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-4 px-3 hover:bg-gray-100 transition-colors">
                                            <Upload size={24} className="text-gray-500" />
                                            <span className="text-sm text-gray-600">
                                                File
                                            </span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) =>
                                                    setUploadedFile(e.target.files?.[0])
                                                }
                                            />
                                        </label>
                                    </div>
                                    {uploadedFile && (
                                        <p className="text-xs text-gray-500 truncate">
                                            Selected: {uploadedFile.name}
                                        </p>
                                    )}
                                </label>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPrescriptionModalOpen(false);
                                        setUploadedFile(null);
                                    }}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={prescriptionLoading || !uploadedFile}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-70"
                                >
                                    {prescriptionLoading ? "Uploading..." : "Submit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Find Medicine Alternative Modal */}
            {alternativeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                            <h3 className="font-semibold text-gray-800">
                                Find Medicine Alternative
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setAlternativeModalOpen(false);
                                    setMedicineName("");
                                }}
                                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleAlternativeSubmit} className="p-4">
                            {error && (
                                <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">
                                    Medicine name
                                </span>
                                <input
                                    type="text"
                                    value={medicineName}
                                    onChange={(e) => setMedicineName(e.target.value)}
                                    placeholder="Enter medicine name"
                                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                                />
                            </label>
                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAlternativeModalOpen(false);
                                        setMedicineName("");
                                    }}
                                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={alternativeLoading || !medicineName?.trim()}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-70"
                                >
                                    {alternativeLoading ? "Searching..." : "Submit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
