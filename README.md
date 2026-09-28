# Inventory & Delivery Management System

A full-stack DBMS project — React + Python Flask + MySQL.

## Default Credentials (all passwords: `password123`)

| Name | Email | Role |
|---|---|---|
| Tanishk Yadav | tanishk@manager.com | Manager |
| Agam Jain | agam@customer.com | Customer |
| Saksham Kejriwal | saksham@customer.com | Customer |
| Aryan Goyal | aryan@customer.com | Customer |
| Saksham Chauhan | chauhan@delpart.com | Delivery (Two-Wheeler) |
| Rishabh | rishabh@delpart.com | Delivery (Van) |

---

## Setup Instructions

### 1. Database

```bash
# Log in to MySQL and run the schema
mysql -u tanishkyadav -p < backend/schema.sql
# (or replace tanishkyadav with root)
```

### 2. Backend

```bash
cd backend

# Create a .env from the template
cp .env.template .env
# Edit .env — set MYSQL_PASSWORD and SECRET_KEY

# Create a virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

pip install -r requirements.txt

# Start Flask on port 8000
python app.py
```

### 3. Frontend

```bash
cd frontend
npm install
npm start          # starts on http://localhost:3000
```

---

## How It Works

### Order Lifecycle
```
Customer places order  →  [Pending Review]
                            ↓
Manager dispatches     →  [Pending Delivery]  (General or Exclusive routing)
                            ↓
Delivery Partner accepts → [In Transit]  (ETA set)
                            ↓
Partner finalizes      →  [Delivered] or [Not Delivered]
```

### Role Detection
Roles are derived **purely from the email domain** — no roles table exists.

| Domain | Role |
|---|---|
| @manager.com | Manager |
| @customer.com | Customer |
| @delpart.com | Delivery Partner |

### Dispatch Modes
- **General** — visible to all active delivery partners  
- **Exclusive (vehicle filter)** — only partners with matching `vehicle_type` see it  
- **Exclusive (direct assign)** — only the specific chosen driver sees it  

### DPI Formula
```
DPI = (10 × Delivered) − (5 × Not Delivered) + Total km driven
```

### Multi-Order Stacking
Delivery partners can accept multiple orders simultaneously — no restriction enforced.

---

## Project Structure

```
DBMS_Projest/
├── backend/
│   ├── app.py               Flask entry point
│   ├── auth.py              Login + Register (werkzeug hashing)
│   ├── config.py            .env reader
│   ├── db.py                MySQL connection helper
│   ├── middleware.py        JWT role decorator
│   ├── schema.sql           DB schema + seed data
│   ├── requirements.txt
│   ├── .env.template        Copy → .env, fill password
│   └── routes/
│       ├── orders.py        Order CRUD + dispatch + accept/finalize
│       ├── products.py      Product CRUD + category filter
│       ├── users.py         User list + suspend toggle
│       └── manager.py       DPI leaderboard
└── frontend/
    ├── .env                 REACT_APP_API_URL
    ├── package.json
    └── src/
        ├── App.jsx          Router + role-protected routes
        ├── index.css        Global styles
        ├── api/axios.js     JWT-aware Axios instance
        ├── context/AuthContext.jsx
        ├── components/ProtectedRoute.jsx
        └── pages/
            ├── Login.jsx             Login + Register
            ├── CustomerDashboard.jsx Browse + My Orders
            ├── ManagerDashboard.jsx  5-tab manager panel
            └── DeliveryDashboard.jsx Open Board + My Deliveries
```
