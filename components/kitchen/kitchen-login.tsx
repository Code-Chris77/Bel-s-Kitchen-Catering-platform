"use client";

import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";

type KitchenLoginProps = {
  checking: boolean;
  staffRequired: boolean;
  staffName: string;
  onStaffName: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  signingIn: boolean;
  error: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function KitchenLogin({
  checking,
  staffRequired,
  staffName,
  onStaffName,
  password,
  onPassword,
  signingIn,
  error,
  onSubmit,
}: KitchenLoginProps) {
  return (
        <section className="kitchen-login-shell">
          <div className="kitchen-login-card">
            <span className="tracking-icon" aria-hidden="true"><KeyRound /></span>
            <p className="eyebrow">KITCHEN STAFF ONLY</p>
            <h1>{checking ? "Opening kitchen…" : "Enter the kitchen."}</h1>
            {checking ? (
              <p>Checking your secure kitchen session.</p>
            ) : (
              <>
                <p>{staffRequired ? "Sign in with your staff name and password." : "Enter the staff password"} to see paid orders and update their progress.</p>
                <form onSubmit={onSubmit}>
                  {staffRequired && (
                    <>
                      <label htmlFor="kitchen-name">Your name</label>
                      <input
                        id="kitchen-name"
                        value={staffName}
                        onChange={(event) => onStaffName(event.target.value)}
                        autoComplete="username"
                        placeholder="Enter your staff name"
                        required
                        autoFocus
                      />
                    </>
                  )}
                  <label htmlFor="kitchen-password">{staffRequired ? "Your password" : "Kitchen password"}</label>
                  <input
                    id="kitchen-password"
                    type="password"
                    value={password}
                    onChange={(event) => onPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter staff password"
                    required
                    autoFocus={!staffRequired}
                  />
                  {error && <p className="tracking-error" role="alert">{error}</p>}
                  <Button type="submit" className="tracking-submit" disabled={signingIn || !password || (staffRequired && !staffName.trim())}>
                    {signingIn ? "Unlocking…" : "Open kitchen queue"}
                  </Button>
                </form>
                <small>Customer tracking passwords cannot open this staff screen.</small>
              </>
            )}
          </div>
        </section>
  );
}
