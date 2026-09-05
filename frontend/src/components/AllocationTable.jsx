import { useEffect, useState } from "react";
import { api } from "../lib/api";

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Reusable allocation table row renderer shared by global + employee pages.
export function AllocRows({ allocations }) {
  return allocations.map((a) => (
    <tr key={a.id}>
      <td>{a.employee?.name || "—"}</td>
      <td>{a.timeOffType?.name || "—"}</td>
      <td>
        <strong>{Number(a.quota)}</strong> {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}
      </td>
      <td>
        <strong>{Number(a.remaining)}</strong> {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}
      </td>
      <td>{fmtDate(a.validFrom)} → {fmtDate(a.validTo)}</td>
      <td>
        {a.approvedByHR ? (
          <span className="status-pill">Approved</span>
        ) : (
          <span className="status-pill amber">Pending OK</span>
        )}
      </td>
    </tr>
  ));
}