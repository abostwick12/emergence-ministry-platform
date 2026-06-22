"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCamp } from "@/components/camp/camp-provider";
import type { CampVisibleStudent } from "@/lib/camp/types";

export default function CampVehiclesPage() {
  const { overview, loading } = useCamp();

  const ridersByVehicle = useMemo(() => {
    const map = new Map<string, CampVisibleStudent[]>();
    for (const student of overview.students) {
      if (!student.vehicleId) continue;
      const list = map.get(student.vehicleId) ?? [];
      list.push(student);
      map.set(student.vehicleId, list);
    }
    return map;
  }, [overview.students]);

  return (
    <div className="camp-cc-page">
      <Link href="/camp/more" className="camp-cc-back">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span>More</span>
      </Link>
      <header className="camp-cc-page-head">
        <h1>Transportation</h1>
        <p className="camp-cc-muted">{overview.vehicles.length} vehicles</p>
      </header>
      {loading && !overview.vehicles.length ? (
        <p className="camp-cc-muted">Loading vehicles…</p>
      ) : (
        <div className="camp-vehicle-list">
          {overview.vehicles.map((vehicle) => {
            const riders = ridersByVehicle.get(vehicle.id) ?? [];
            return (
              <section key={vehicle.id} className="camp-vehicle-card" aria-label={vehicle.name}>
                <div className="camp-vehicle-head">
                  <strong>{vehicle.name}</strong>
                  <span className="camp-cc-muted">{riders.length} riders</span>
                </div>
                <p className="camp-cc-muted">Driver: {vehicle.driver || "Unassigned"}</p>
                {vehicle.departureWindow ? <p className="camp-cc-muted">Departs: {vehicle.departureWindow}</p> : null}
                {riders.length ? (
                  <ul className="camp-vehicle-riders">
                    {riders.map((rider) => (
                      <li key={rider.id}>
                        <span className="camp-student-avatar sm" aria-hidden="true">{rider.photoInitials}</span>
                        <span>{rider.name}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="camp-cc-muted">No riders visible for this access view.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
