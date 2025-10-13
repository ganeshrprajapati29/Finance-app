import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import axios from "axios";

export default function AdminDashboard() {
  const [stats, setStats] = useState({});

  useEffect(() => {
    axios.get("/admin/stats").then((r) => setStats(r.data.data));
  }, []);

  const chartData = [
    { name: "Pending", value: stats.pending || 0 },
    { name: "Approved", value: stats.approved || 0 },
    { name: "Disbursed", value: stats.disbursed || 0 },
  ];

  return (
    <div className="p-4">
      <h3 className="text-xl font-bold mb-3">Loan Overview</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#0f3460" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
