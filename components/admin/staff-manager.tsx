"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StaffMember = { id: number; name: string; active: boolean };

async function request(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json()) as { error?: string; staff?: StaffMember | StaffMember[] };
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export function StaffManager() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await request("/api/admin-staff", "GET");
      setStaff(data.staff as StaffMember[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Staff could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const addStaff = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(async () => {
      await request("/api/admin-staff", "POST", { name, password });
      setName("");
      setPassword("");
    }, "Staff account created");
  };

  return (
    <section className="admin-settings-card admin-wide-card" aria-labelledby="staff-heading">
      <span className="admin-settings-icon" aria-hidden="true"><UserPlus /></span>
      <p className="eyebrow">KITCHEN STAFF</p>
      <h2 id="staff-heading">Individual staff accounts.</h2>
      <p>
        Give each chef their own name and password so every order update is recorded against them.
        Once the first account exists, the shared kitchen password stops working.
      </p>

      {staff.length > 0 && (
        <ul className="admin-list">
          {staff.map((member) => (
            <li key={member.id}>
              <span><strong>{member.name}</strong> <small>{member.active ? "Active" : "Disabled"}</small></span>
              <span className="admin-list-actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    const next = window.prompt(`New password for ${member.name} (8–80 characters)`);
                    if (next) void run(() => request("/api/admin-staff", "PATCH", { id: member.id, password: next }), "Password reset");
                  }}
                >
                  Reset password
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () => request("/api/admin-staff", "PATCH", { id: member.id, active: !member.active }),
                      member.active ? "Account disabled" : "Account enabled",
                    )
                  }
                >
                  {member.active ? "Disable" : "Enable"}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addStaff}>
        <div className="admin-field">
          <Label htmlFor="staff-name">Staff name</Label>
          <Input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required />
        </div>
        <div className="admin-field">
          <Label htmlFor="staff-password">Password</Label>
          <Input
            id="staff-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={80}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <Button className="admin-primary-button" type="submit" disabled={busy || !name.trim() || !password}>
          <UserPlus /> Add staff member
        </Button>
      </form>
    </section>
  );
}
