import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const DELIVERY_PILL = {
  PENDING: "dlv-pending",
  SENT: "dlv-sent",
  FAILED: "dlv-failed",
};

export default function Payslips() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);

  useEffect(() => {
    api("/payslips")
      .then(setList)
      .catch((e) => alert(e.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Payslips</h1>
        <span className="muted small">{list.length} total</span>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th className="num">Gross</th>
            <th className="num">Deductions</th>
            <th className="num">Net</th>
            <th>Delivery</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="clickable-row" onClick={() => navigate(`/payslips/${p.id}`)}>
              <td>
                <strong>{p.employee?.name}</strong>
                <div className="muted small">{p.employee?.jobPosition}</div>
              </td>
              <td>{p.employee?.department}</td>
              <td className="num">₹{Number(p.grossTotal || 0).toLocaleString()}</td>
              <td className="num">₹{Number(p.deductionTotal || 0).toLocaleString()}</td>
              <td className="num"><strong>₹{Number(p.netTotal || 0).toLocaleString()}</strong></td>
              <td>
                <span className={"status-pill " + (DELIVERY_PILL[p.deliveryStatus] || "dlv-pending")}>
                  {p.deliveryStatus || "PENDING"}
                </span>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={6} className="muted">No payslips yet — create and compute a payrun first.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}