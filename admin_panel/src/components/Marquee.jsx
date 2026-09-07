import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Marquee() {
  const [messages, setMessages] = useState([
    "Welcome to Khatu Pay Admin Dashboard",
    "New loan applications available",
    "Check recent notifications"
  ]);

  useEffect(() => {
    const fetchMarqueeData = async () => {
      try {
        const response = await api.get("/admin/marquee");
        const data = response.data.data || [];
        if (data.length > 0) {
          setMessages(data);
        }
      } catch (error) {
        console.error("Failed to fetch marquee data:", error);
        // Keep default messages
      }
    };

    fetchMarqueeData();
    // Refresh every 30 seconds for dynamic updates
    const interval = setInterval(fetchMarqueeData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Duplicate messages for continuous scrolling
  const duplicatedMessages = messages.concat(messages);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-dark py-3 overflow-hidden shadow-lg border-b-2 border-blue-800">
      <div className="animate-marquee whitespace-nowrap">
        {duplicatedMessages.map((msg, index) => (
          <span key={index} className="mx-12 text-sm font-semibold inline-flex items-center">
            <span className="mr-2">📢</span>
            {msg}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
}