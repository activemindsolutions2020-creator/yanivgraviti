"use client";
import { useState } from "react";

export default function ProfileForm() {
    const [formData, setFormData] = useState({
        idNumber: "",
        userCode: "",
        govToken: "",
    });
    const [status, setStatus] = useState({ type: "", message: "" });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: "", message: "" });

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
            const res = await fetch(`${apiUrl}/api/profile`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (res.ok) {
                setStatus({ type: "success", message: "הפרופיל נשמר בהצלחה בשרת" });
            } else {
                setStatus({ type: "error", message: "An unexpected error occurred" });
            }
        } catch (error) {
            console.error("Error saving profile:", error);
            setStatus({ type: "error", message: "An unexpected error occurred" });
        }
    };

    return (
        <div className="w-full max-w-md p-6 bg-transparent">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-center">
                <input
                    type="text"
                    name="idNumber"
                    placeholder="123456"
                    value={formData.idNumber}
                    onChange={handleChange}
                    className="w-full p-4 bg-blue-50/50 rounded-xl outline-none text-center"
                />

                <input
                    type="text"
                    name="userCode"
                    placeholder="3456"
                    value={formData.userCode}
                    onChange={handleChange}
                    className="w-full p-4 bg-blue-50/50 rounded-xl outline-none text-center"
                />

                <input
                    type="text"
                    name="govToken"
                    placeholder="Gov API Token"
                    value={formData.govToken}
                    onChange={handleChange}
                    className="w-full p-4 bg-transparent outline-none text-center text-gray-400 placeholder-gray-400"
                />

                <div className="border-b-2 border-dotted border-gray-400 my-4 w-full"></div>

                <button
                    type="submit"
                    className="font-bold text-gray-700 hover:text-black transition-colors"
                >
                    Save Configuration
                </button>

                {status.message && (
                    <p className={`font-bold mt-2 ${status.type === "success" ? "text-green-500" : "text-red-500"}`}>
                        {status.message}
                    </p>
                )}
            </form>
        </div>
    );
}