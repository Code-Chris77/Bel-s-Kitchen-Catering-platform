"use client";

import { useCallback, useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; name: string; note: string; accent: string; sortOrder: number; active: boolean };
type Tier = { amount: number; active: boolean };
type Zone = { id?: string; label: string; fee: number; sortOrder: number; active: boolean };
type MenuState = { items: Item[]; tiers: Tier[]; zones: Zone[] };

export function MenuEditor() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin-menu", { cache: "no-store" });
      const data = (await response.json()) as MenuState & { error?: string };
      if (!response.ok) throw new Error(data.error || "The menu could not be loaded.");
      setMenu(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The menu could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!menu) return null;

  const patchItem = (id: string, changes: Partial<Item>) =>
    setMenu({ ...menu, items: menu.items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  const patchZone = (index: number, changes: Partial<Zone>) =>
    setMenu({ ...menu, zones: menu.zones.map((zone, i) => (i === index ? { ...zone, ...changes } : zone)) });

  const addPrice = () => {
    const amount = Number(newPrice);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000 || menu.tiers.some((tier) => tier.amount === amount)) {
      toast.error("Enter a new whole-number price between 1 and 1000.");
      return;
    }
    setMenu({ ...menu, tiers: [...menu.tiers, { amount, active: true }].sort((a, b) => a.amount - b.amount) });
    setNewPrice("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin-menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(menu),
      });
      const data = (await response.json()) as MenuState & { error?: string };
      if (!response.ok) throw new Error(data.error || "The menu could not be saved.");
      setMenu(data);
      toast.success("Menu saved. Customers see the changes straight away.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The menu could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-settings-card admin-wide-card" aria-labelledby="menu-heading">
      <span className="admin-settings-icon" aria-hidden="true"><UtensilsCrossed /></span>
      <p className="eyebrow">MENU AND PRICES</p>
      <h2 id="menu-heading">Edit what customers can order.</h2>
      <p>Hidden items, prices and areas stay in past orders. Nothing is ever deleted.</p>

      <h3>Meals</h3>
      <div className="admin-edit-rows">
        {menu.items.map((item) => (
          <div className="admin-edit-row" key={item.id}>
            <Input aria-label={`${item.id} name`} value={item.name} maxLength={60} onChange={(event) => patchItem(item.id, { name: event.target.value })} />
            <Input aria-label={`${item.name} description`} value={item.note} maxLength={160} onChange={(event) => patchItem(item.id, { note: event.target.value })} />
            <Input aria-label={`${item.name} order on page`} type="number" min={0} max={999} value={item.sortOrder} onChange={(event) => patchItem(item.id, { sortOrder: Number(event.target.value) })} />
            <label><input type="checkbox" checked={item.active} onChange={(event) => patchItem(item.id, { active: event.target.checked })} /> Visible</label>
          </div>
        ))}
      </div>

      <h3>Plate prices (GH₵)</h3>
      <div className="admin-edit-row">
        {menu.tiers.map((tier) => (
          <label key={tier.amount}>
            <input
              type="checkbox"
              checked={tier.active}
              onChange={(event) =>
                setMenu({ ...menu, tiers: menu.tiers.map((t) => (t.amount === tier.amount ? { ...t, active: event.target.checked } : t)) })
              }
            />{" "}
            {tier.amount}
          </label>
        ))}
        <Input aria-label="New price" type="number" min={1} max={1000} placeholder="New price" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} />
        <Button variant="outline" type="button" onClick={addPrice}>Add price</Button>
      </div>

      <h3>Delivery areas</h3>
      <div className="admin-edit-rows">
        {menu.zones.map((zone, index) => (
          <div className="admin-edit-row" key={zone.id ?? `new-${index}`}>
            <Input aria-label="Area name" value={zone.label} maxLength={40} onChange={(event) => patchZone(index, { label: event.target.value })} />
            <Input aria-label={`${zone.label} fee`} type="number" min={0} max={1000} value={zone.fee} onChange={(event) => patchZone(index, { fee: Number(event.target.value) })} />
            <label><input type="checkbox" checked={zone.active} onChange={(event) => patchZone(index, { active: event.target.checked })} /> Offered</label>
          </div>
        ))}
        <Button
          variant="outline"
          type="button"
          onClick={() => setMenu({ ...menu, zones: [...menu.zones, { label: "", fee: 0, sortOrder: menu.zones.length + 1, active: true }] })}
        >
          Add delivery area
        </Button>
      </div>

      <Button className="admin-primary-button" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save menu"}
      </Button>
    </section>
  );
}
