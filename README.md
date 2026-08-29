# Bel's Kitchen Catering Service

A full-stack online ordering and catering management platform built with Next.js, Tailwind CSS, TypeScript, and Cloudflare D1 with Drizzle ORM.

---

## Overview & Application Surfaces

| Area | Route | Purpose |
| --- | --- | --- |
| **Customer Ordering** | `/` | Browse menus, select options, add to cart, and place takeout/delivery orders. |
| **Order Tracking** | `/track` | Live tracking statuses: Received, Preparing, Ready, Delivered/Collected. |
| **Kitchen Display System** | `/kitchen` | Real-time queue for kitchen staff to manage pending and active tickets. |
| **Admin Dashboard** | `/admin` | Sales analytics, order totals, and access control management. |

---

## Tech Stack

- **Framework:** Next.js (App Router) & React
- **Styling:** Tailwind CSS & shadcn/ui components
- **Database & ORM:** Cloudflare D1 (SQLite) with Drizzle ORM
- **Language:** TypeScript

---

## Getting Started Locally

### Prerequisites

- Node.js `20.x` or `>= 22.13.0`
- npm

### Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/](https://github.com/)<YOUR-USERNAME>/bels-kitchen-catering.git
   cd bels-kitchen-catering