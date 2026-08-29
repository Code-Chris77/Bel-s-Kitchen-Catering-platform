"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CalendarRange,
  ChefHat,
  KeyRound,
  LockKeyhole,
  LogOut,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { SiteBrand } from "@/components/site-brand";

type Summary = {
  todayRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  todayOrders: number;
  monthOrders: number;
  yearOrders: number;
};

type DailyRecord = {
  day: string;
  revenue: number;
  orderCount: number;
};

type RecentOrder = {
  id: number;
  orderNumber: number;
  customerName: string;
  orderType: string;
  total: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
};

type DashboardData = {
  summary: Summary;
  daily: DailyRecord[];
  recentOrders: RecentOrder[];
};

const emptyDashboard: DashboardData = {
  summary: {
    todayRevenue: 0,
    monthRevenue: 0,
    yearRevenue: 0,
    todayOrders: 0,
    monthOrders: 0,
    yearOrders: 0,
  },
  daily: [],
  recentOrders: [],
};

const paymentLabels: Record<string, string> = {
  mtn: "MTN MoMo",
  telecel: "Telecel Cash",
  at: "AT Money",
  card: "Card",
};

const statusLabels: Record<string, string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  collected: "Collected",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function money(value: number) {
  return `GH₵${Math.round(value).toLocaleString("en-GH")}`;
}

function dateTimeLabel(value: string) {
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function dayLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export default function AdminPage() {
  const [access, setAccess] = useState<"checking" | "granted" | "locked">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newKitchenPassword, setNewKitchenPassword] = useState("");
  const [confirmKitchenPassword, setConfirmKitchenPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/admin-dashboard", { cache: "no-store" });
      const data = (await response.json()) as DashboardData & { error?: string };
      if (response.status === 401) {
        setAccess("locked");
        setDashboard(emptyDashboard);
        setLoadError("");
        return;
      }
      if (!response.ok || !data.summary) {
        throw new Error(data.error || "The dashboard could not be loaded.");
      }
      setDashboard(data);
      setAccess("granted");
      setLoadError("");
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(initial);
  }, [loadDashboard]);

  const averageOrder = useMemo(() => {
    if (!dashboard.summary.todayOrders) return 0;
    return dashboard.summary.todayRevenue / dashboard.summary.todayOrders;
  }, [dashboard.summary]);

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSigningIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { authenticated?: boolean; error?: string };
      if (!response.ok || !data.authenticated) {
        throw new Error(data.error || "The restaurant email or password is incorrect.");
      }
      setPassword("");
      await loadDashboard();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Administrator access failed.");
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin-auth", { method: "DELETE" });
    setAccess("locked");
    setDashboard(emptyDashboard);
    setLastUpdated(null);
  };

  const updateKitchenPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newKitchenPassword !== confirmKitchenPassword) {
      toast.error("The two kitchen passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/admin-settings/kitchen-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newKitchenPassword }),
      });
      const data = (await response.json()) as { updated?: boolean; error?: string };
      if (response.status === 401) {
        setAccess("locked");
        throw new Error("Your admin session ended. Sign in again.");
      }
      if (!response.ok || !data.updated) {
        throw new Error(data.error || "The kitchen password could not be changed.");
      }
      setNewKitchenPassword("");
      setConfirmKitchenPassword("");
      toast.success("Kitchen password changed", {
        description: "Existing kitchen sessions have been locked. Staff must use the new password.",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The kitchen password could not be changed.");
    } finally {
      setSavingPassword(false);
    }
  };

  if (access !== "granted") {
    return (
      <main className="admin-page admin-login-page">
        <nav className="admin-nav">
          <SiteBrand />
          <Link className="kitchen-back" href="/"><ArrowLeft /> Customer menu</Link>
        </nav>

        <section className="admin-login-shell">
          <div className="admin-login-card">
            <span className="admin-login-icon" aria-hidden="true"><ShieldCheck /></span>
            <p className="eyebrow">RESTAURANT OWNER</p>
            <h1>{access === "checking" ? "Opening records…" : "Admin sign in."}</h1>
            {access === "checking" ? (
              <p>Checking your secure administrator session.</p>
            ) : (
              <>
                <p>Use the restaurant email and administrator password to view sales, orders and kitchen settings.</p>
                <form onSubmit={submitLogin}>
                  <div className="admin-field">
                    <Label htmlFor="admin-email">Restaurant email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="username"
                      placeholder="restaurant@email.com"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="admin-field">
                    <Label htmlFor="admin-password">Administrator password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="current-password"
                      placeholder="Enter password"
                      required
                    />
                  </div>
                  {loginError && <p className="admin-form-error" role="alert">{loginError}</p>}
                  <Button type="submit" className="admin-primary-button" disabled={signingIn || !email || !password}>
                    <LockKeyhole /> {signingIn ? "Signing in…" : "Open admin dashboard"}
                  </Button>
                </form>
                <small>Kitchen and customer tracking passwords cannot open this page.</small>
              </>
            )}
          </div>
        </section>
      </main>
    );
  }

  const stats = [
    { label: "Today", revenue: dashboard.summary.todayRevenue, orders: dashboard.summary.todayOrders, icon: CalendarDays },
    { label: "This month", revenue: dashboard.summary.monthRevenue, orders: dashboard.summary.monthOrders, icon: CalendarRange },
    { label: "This year", revenue: dashboard.summary.yearRevenue, orders: dashboard.summary.yearOrders, icon: WalletCards },
  ];

  return (
    <main className="admin-page">
      <Toaster position="top-center" richColors />
      <nav className="admin-nav">
        <SiteBrand admin />
        <div className="admin-nav-actions">
          <Link className="kitchen-back" href="/kitchen"><ChefHat /> Kitchen queue</Link>
          <Button variant="outline" onClick={() => void logout()}><LogOut /> Sign out</Button>
        </div>
      </nav>

      <header className="admin-header">
        <div>
          <p className="eyebrow">FINANCIAL OVERVIEW</p>
          <h1>Restaurant records.</h1>
          <p>Sales and paid order totals update directly from the Bel&apos;s Kitchen ordering system.</p>
        </div>
        <div className="admin-refresh-wrap">
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-GH", { hour: "numeric", minute: "2-digit" })}` : "Connecting…"}</span>
          <Button variant="outline" onClick={() => void loadDashboard()} disabled={loading}>
            <RefreshCw className={loading ? "spin" : ""} /> Refresh records
          </Button>
        </div>
      </header>

      {loadError && <div className="admin-load-error" role="alert">{loadError}</div>}

      <section className="admin-stat-grid" aria-label="Sales summary">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="admin-stat-card" key={stat.label}>
              <div className="admin-stat-top"><span>{stat.label}</span><Icon /></div>
              <strong>{money(stat.revenue)}</strong>
              <p><ShoppingBag /> {stat.orders} {stat.orders === 1 ? "order" : "orders"}</p>
            </article>
          );
        })}
        <article className="admin-stat-card admin-average-card">
          <div className="admin-stat-top"><span>Average today</span><ReceiptText /></div>
          <strong>{money(averageOrder)}</strong>
          <p>Per paid order today</p>
        </article>
      </section>

      <section className="admin-workspace">
        <div className="admin-records-card">
          <Tabs defaultValue="daily">
            <div className="admin-card-heading">
              <div><p className="eyebrow">TRANSACTION RECORDS</p><h2>Money and orders.</h2></div>
              <TabsList>
                <TabsTrigger value="daily">Daily totals</TabsTrigger>
                <TabsTrigger value="orders">Recent orders</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="daily">
              <Table className="admin-table">
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Orders received</TableHead><TableHead className="admin-money-cell">Sales</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.daily.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="admin-empty-cell">No paid orders have been recorded yet.</TableCell></TableRow>
                  ) : dashboard.daily.map((record) => (
                    <TableRow key={record.day}>
                      <TableCell><strong>{dayLabel(record.day)}</strong></TableCell>
                      <TableCell>{record.orderCount}</TableCell>
                      <TableCell className="admin-money-cell"><strong>{money(record.revenue)}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="orders">
              <Table className="admin-table">
                <TableHeader>
                  <TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Placed</TableHead><TableHead>Type</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="admin-money-cell">Total</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="admin-empty-cell">No orders have been recorded yet.</TableCell></TableRow>
                  ) : dashboard.recentOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell><strong>#{order.orderNumber}</strong></TableCell>
                      <TableCell>{order.customerName}</TableCell>
                      <TableCell>{dateTimeLabel(order.createdAt)}</TableCell>
                      <TableCell>{order.orderType === "dine_in" ? "Restaurant" : "Delivery"}</TableCell>
                      <TableCell>{paymentLabels[order.paymentMethod] || order.paymentMethod}</TableCell>
                      <TableCell><span className={`admin-status admin-status-${order.status}`}>{statusLabels[order.status] || order.status}</span></TableCell>
                      <TableCell className="admin-money-cell"><strong>{money(order.total)}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="admin-settings-card">
          <span className="admin-settings-icon" aria-hidden="true"><KeyRound /></span>
          <p className="eyebrow">KITCHEN SECURITY</p>
          <h2>Change staff password.</h2>
          <p>Update the password chefs use to open the kitchen queue. The previous password stops working immediately.</p>
          <form onSubmit={updateKitchenPassword}>
            <div className="admin-field">
              <Label htmlFor="new-kitchen-password">New kitchen password</Label>
              <Input
                id="new-kitchen-password"
                type="password"
                value={newKitchenPassword}
                onChange={(event) => setNewKitchenPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={80}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="admin-field">
              <Label htmlFor="confirm-kitchen-password">Confirm new password</Label>
              <Input
                id="confirm-kitchen-password"
                type="password"
                value={confirmKitchenPassword}
                onChange={(event) => setConfirmKitchenPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={80}
                placeholder="Enter it again"
                required
              />
            </div>
            <Button className="admin-primary-button" type="submit" disabled={savingPassword || !newKitchenPassword || !confirmKitchenPassword}>
              <KeyRound /> {savingPassword ? "Updating…" : "Update kitchen password"}
            </Button>
          </form>
          <div className="admin-security-note"><ShieldCheck /><span>The password is securely stored and is never shown in the financial records.</span></div>
        </aside>
      </section>
    </main>
  );
}
