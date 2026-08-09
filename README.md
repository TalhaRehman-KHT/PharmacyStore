# 💊 Smart Pharmacy & Prescription Management System

> **Final Year Project (FYP) — BS Computer Science**

A full-stack **Smart Pharmacy & Prescription Management System** designed to connect pharmacy/store management with intelligent customer-side healthcare assistance.

The system is divided into two major sides:

* 🏪 **Vendor Side** — Pharmacy Store & Medicine Management
* 👤 **Customer Side** — Prescription Assistance & Medicine Management

The goal of the project is to reduce manual pharmacy management work while helping customers better understand their prescriptions, manage their medicines, and discover suitable alternatives.

---

## 📌 Project Overview

Traditional pharmacy management often requires store owners to manually maintain medicine inventory, monitor different medicine batches, and keep track of expiry dates.

On the customer side, prescriptions can also be difficult to understand, while patients may forget when to take their medicines or may not know about alternative medicines.

To address these problems, this project provides a centralized platform with **pharmacy management features for vendors** and **AI-assisted prescription and medicine features for customers**.

### The system focuses on:

* Medicine and pharmacy inventory management
* Batch-based medicine tracking
* Medicine expiry monitoring
* Expiry alerts and notifications
* Prescription assistance
* Prescription information presented in an easier-to-understand way
* Medicine reminders according to prescribed medication schedules
* Alternative medicine information
* Role-based access for different types of users

---

# 🎯 Main Objectives

The primary objectives of this project are:

1. Digitize pharmacy store management.
2. Manage medicines through individual batches.
3. Track medicine expiry dates efficiently.
4. Notify vendors about medicines approaching expiry.
5. Help customers understand prescription information more easily.
6. Provide medicine-taking reminders based on prescription information.
7. Provide information about possible medicine alternatives.
8. Provide a centralized platform for pharmacy and customer-side workflows.
9. Reduce manual record keeping and improve overall efficiency.

---

# 🏗️ System Architecture

The application is divided into two primary modules:

```text
                    ┌─────────────────────────┐
                    │   Smart Pharmacy System │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┴────────────────┐
                │                                 │
        ┌───────▼────────┐               ┌────────▼────────┐
        │  Vendor Side   │               │ Customer Side   │
        └───────┬────────┘               └────────┬────────┘
                │                                 │
        ┌───────▼────────┐               ┌────────▼────────┐
        │ Pharmacy Store │               │   Prescription  │
        │   Management   │               │    Assistance   │
        └───────┬────────┘               └────────┬────────┘
                │                                 │
        ┌───────▼────────┐               ┌────────▼────────┐
        │ Batch Tracking │               │ Medicine        │
        │ & Inventory    │               │ Reminders       │
        └───────┬────────┘               └────────┬────────┘
                │                                 │
        ┌───────▼────────┐               ┌────────▼────────┐
        │ Expiry Alerts  │               │ Alternatives    │
        │ & Notifications│               │ & Explanation   │
        └────────────────┘               └─────────────────┘
```

---

# 🏪 Vendor Side — Pharmacy Store Management

The vendor module is designed for pharmacy/store owners or authorized pharmacy staff.

It provides tools to manage medicines and monitor inventory efficiently.

## 📦 Medicine Management

Vendors can manage medicine information and maintain organized pharmacy inventory.

The system allows pharmacy data to be maintained digitally instead of relying completely on manual records.

### Key capabilities include:

* Add medicines
* Update medicine information
* Manage medicine inventory
* Track available quantities
* Maintain medicine batches
* Monitor batch-level expiry dates
* View medicine information
* Manage pharmacy-related records

---

# 🧪 Batch-Based Medicine Management

One of the important features of the system is **batch-level medicine management**.

Instead of treating all units of a medicine as one inventory record, medicines can be associated with their respective batches.

For example:

```text
Medicine: Paracetamol

Batch A
├── Quantity: 100
├── Manufacturing Date: ...
└── Expiry Date: ...

Batch B
├── Quantity: 150
├── Manufacturing Date: ...
└── Expiry Date: ...
```

This approach makes it easier for pharmacy vendors to identify which specific batch is approaching expiry.

---

# ⚠️ Medicine Expiry Monitoring

Medicine expiry is an important part of pharmacy inventory management.

The system monitors medicine batches based on their expiry dates and can generate alerts when medicines are approaching expiry.

### Example workflow:

```text
Medicine Added
      ↓
Batch Created
      ↓
Expiry Date Stored
      ↓
System Monitors Batch
      ↓
Expiry Approaching
      ↓
Vendor Receives Alert
```

This helps pharmacy owners identify medicines that require attention before they expire.

---

# 🔔 Expiry Alerts & Notifications

The vendor can receive notifications related to medicines whose expiry dates are approaching.

This feature is intended to reduce the possibility of expired medicines remaining unnoticed in the pharmacy inventory.

### Benefits

* Better inventory awareness
* Easier batch monitoring
* Reduced manual checking
* Early identification of expiring medicines
* Improved pharmacy inventory management

---

# 👤 Customer Side

The customer module focuses on helping users manage and understand their prescribed medicines.

Instead of only storing prescription information, the system provides additional assistance around the prescription.

---

# 📄 Prescription Assistance

Prescriptions can sometimes be difficult for patients to understand because they may contain medical terminology, abbreviated instructions, dosage information, and medicine names.

The system provides an easier way for customers to interact with their prescription information.

### Customer workflow

```text
Prescription
     ↓
Prescription Information
     ↓
System Processes Information
     ↓
Important Medicine Details
     ↓
Easier Understanding
```

The purpose is to make prescription information more accessible and easier to follow.

---

# 💊 Medicine Reminders

The customer side includes a medicine reminder feature.

Based on the medication instructions available from the prescription, users can receive reminders about when they need to take their medicines.

For example:

```text
Medicine: Example Medicine

Morning     → 08:00 AM
Afternoon   → 02:00 PM
Night       → 08:00 PM
```

This feature is intended to help users maintain their medication schedule and reduce the chances of forgetting a dose.

> **Note:** Reminder information is based on the prescription/instructions provided by the user or healthcare professional. The system is not intended to replace a doctor's medical advice.

---

# 🔄 Medicine Alternatives

The customer side also provides information about possible alternative medicines.

If an alternative is available in the system, the customer can view the relevant alternative information.

This can be useful when a particular medicine may not be available through the pharmacy.

> Alternative medicine information should be considered informational only. Customers should consult a qualified healthcare professional or pharmacist before substituting prescribed medication.

---

# 🤖 AI-Assisted Features

One of the key aspects of the project is the integration of intelligent features into the customer experience.

The AI-oriented functionality focuses on helping users interact with prescription information in a more understandable way.

### AI-assisted functionality includes:

* Prescription information interpretation
* Easier presentation of prescription details
* Medicine-related information assistance
* Alternative medicine information
* Prescription-based reminder assistance

The AI functionality is designed as an **assistive layer**, while medical decisions remain with qualified healthcare professionals.

---

# 🔐 Authentication & User Roles

The application supports role-based access.

Users can register/login and access functionality according to their role.

### Main roles

```text
                 Authentication
                       │
              ┌────────┴────────┐
              │                 │
           Vendor            Customer
              │                 │
      Pharmacy Management   Prescription
      Inventory             Assistance
      Batches               Reminders
      Expiry Alerts         Alternatives
```

This separation keeps vendor and customer functionality organized within the same platform.

---

# 🗄️ Database Design

The project uses **PostgreSQL** through **Supabase** as its database/backend platform.

The database was designed to support both pharmacy management and customer-side functionality.

### Major data areas include:

* Users
* Vendors
* OTP/authentication records
* Medicines/items
* Medicine alternatives
* AI recommendations
* Medicine alerts
* Cart items
* Audit logs

The system maintains relationships between users, vendors, medicines, batches, alerts, and other application data.

---

# 🛠️ Technology Stack

## Frontend

* ⚛️ React.js
* 🎨 Tailwind CSS
* 🎯 Lucide React
* JavaScript
* Responsive UI

## Backend

* 🟢 Node.js
* 🚂 Express.js
* REST APIs
* Middleware-based architecture

## Database & Backend Services

* 🐘 PostgreSQL
* ☁️ Supabase

## Authentication & Communication

* Authentication & role-based access
* OTP-based workflows
* Nodemailer
* Mailtrap

## AI / Intelligent Features

* AI-assisted prescription processing
* Prescription information assistance
* Medicine recommendation/alternative functionality

## Development Tools

* Git
* GitHub
* npm
* ESLint
* Vite

---

# 📂 Core Functional Modules

| Module                     | Description                                    |
| -------------------------- | ---------------------------------------------- |
| 🔐 Authentication          | User registration and login                    |
| 👥 Role Management         | Vendor and customer access                     |
| 🏪 Pharmacy Management     | Manage pharmacy/store information              |
| 💊 Medicine Management     | Manage medicine records                        |
| 📦 Batch Management        | Track medicine batches                         |
| ⚠️ Expiry Monitoring       | Monitor medicine expiry dates                  |
| 🔔 Alerts                  | Notify vendors about important medicine events |
| 📄 Prescription Assistance | Help users understand prescription information |
| ⏰ Medicine Reminders       | Prescription-based medicine reminders          |
| 🔄 Alternatives            | Display alternative medicine information       |
| 🤖 AI Assistance           | Intelligent prescription/medicine assistance   |
| 📝 Audit Logs              | Maintain application activity records          |

---

# 🔄 Overall User Flow

## Vendor Flow

```text
Vendor Registration/Login
          ↓
Vendor Dashboard
          ↓
Manage Pharmacy
          ↓
Add / Manage Medicines
          ↓
Create Medicine Batches
          ↓
Monitor Inventory
          ↓
Monitor Expiry Dates
          ↓
Receive Expiry Alerts
```

## Customer Flow

```text
Customer Registration/Login
          ↓
Customer Dashboard
          ↓
Add / Upload Prescription
          ↓
Prescription Assistance
          ↓
Understand Medicine Information
          ↓
Set / Receive Medicine Reminders
          ↓
View Alternative Medicine Information
```

---

# 🧩 Database Entities

The project includes database structures supporting different areas of the application.

Some of the major entities include:

```text
Users
  │
  ├── Vendors
  │
  ├── OTPs
  │
  └── Customer Features
          │
          ├── Alerts
          ├── Cart Items
          └── Prescription-related Data

Items / Medicines
  │
  ├── Batches
  ├── Medicine Alternatives
  ├── AI Recommendations
  └── Alerts

Audit Logs
```

---

# 📸 Screenshots

> Add your project screenshots here to make the repository easier to understand.

### 🔐 Authentication

*Add login/register screenshots here.*

### 🏪 Vendor Dashboard

*Add vendor dashboard screenshot here.*

### 💊 Medicine Management

*Add medicine management screenshot here.*

### 📦 Batch Management

*Add batch management screenshot here.*

### ⚠️ Expiry Alerts

*Add expiry notification screenshot here.*

### 👤 Customer Dashboard

*Add customer dashboard screenshot here.*

### 📄 Prescription Assistance

*Add prescription feature screenshot here.*

### ⏰ Medicine Reminder

*Add reminder screenshot here.*

### 🔄 Medicine Alternatives

*Add alternative medicine screenshot here.*

---

# 🚀 Getting Started

## Prerequisites

Make sure you have the following installed:

* Node.js
* npm
* Git
* A Supabase account/project

---

## 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_DIRECTORY>
```

---

## 2. Install Dependencies

If the project contains separate frontend and backend directories:

```bash
cd client
npm install
```

Then:

```bash
cd ../server
npm install
```

> Adjust the directory names according to the actual repository structure.

---

# 🔑 Environment Variables

Create a `.env` file for the backend and configure the required environment variables.

Example:

```env
PORT=5000

SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

EMAIL_USER=your_email
EMAIL_PASSWORD=your_password

MAILTRAP_HOST=your_mailtrap_host
MAILTRAP_PORT=your_mailtrap_port
MAILTRAP_USER=your_mailtrap_user
MAILTRAP_PASSWORD=your_mailtrap_password
```

**Never commit your real `.env` file or secret credentials to GitHub.**

Add the following to `.gitignore`:

```gitignore
.env
node_modules/
```

---

# ▶️ Running the Project

Start the backend:

```bash
npm run dev
```

Start the frontend:

```bash
npm run dev
```

The application should then be available through the local development URL provided by Vite/your configured server.

---

# 🧪 Project as a Final Year Project

This project was developed as a **Final Year Project (FYP)** during my BS Computer Science degree.

The project combines several areas of software engineering:

* Full-stack web development
* REST API development
* Database design
* Authentication
* Role-based access control
* Pharmacy inventory management
* Batch-based inventory tracking
* Notification systems
* AI-assisted functionality
* Responsive frontend development
* Cloud database integration

It provided practical experience in designing and developing a complete software system rather than a simple CRUD application.

---

# 🎓 Learning Outcomes

Through this project, I gained practical experience in:

* Designing a full-stack application architecture
* Building RESTful APIs with Node.js and Express
* Developing responsive interfaces with React and Tailwind CSS
* Designing relational databases with PostgreSQL
* Working with Supabase
* Implementing authentication workflows
* Implementing role-based application logic
* Managing medicine inventory and batches
* Working with expiry-based alerts
* Integrating AI-assisted functionality
* Working with email/OTP workflows
* Structuring a production-style web application
* Using Git and GitHub for version control

---

# 🔮 Future Improvements

Potential future improvements include:

* 📱 Dedicated mobile application
* 🔔 Push notifications
* 📷 Improved prescription scanning/OCR
* 🤖 More advanced AI prescription assistance
* 📊 Pharmacy analytics and reporting
* 🧾 Digital invoices and receipts
* 🏪 Multi-branch pharmacy support
* 🔍 Advanced medicine search
* 📦 Automated stock-level alerts
* 👨‍⚕️ Doctor/pharmacist integration
* 💳 Online payment integration
* ☁️ Improved cloud deployment architecture

---

# ⚠️ Medical Disclaimer

This project is an **academic/software engineering project** and is not intended to provide medical diagnosis or replace professional medical advice.

Prescription interpretation, medicine information, reminders, and alternative medicine information are intended to assist users with understanding and managing information provided by qualified healthcare professionals.

Users should always consult a qualified doctor or pharmacist before changing, replacing, or stopping any medication.

---

# 👨‍💻 Developer

**Talha Rehman**

Full Stack Software Engineer | MERN | PERN | Gen-AI

* GitHub: [TalhaRehman-KHT](https://github.com/TalhaRehman-KHT?utm_source=chatgpt.com)
* Portfolio: [talha-five.vercel.app](https://talha-five.vercel.app?utm_source=chatgpt.com)
* LinkedIn: [Talha Rehman on LinkedIn](https://www.linkedin.com/in/talha-rehman-460014218/?utm_source=chatgpt.com)

---

# ⭐ Acknowledgment

This project was developed as part of my **BS Computer Science Final Year Project** and represents my practical work in full-stack development, database engineering, pharmacy management, and AI-assisted healthcare software.

If you find the project useful or interesting, consider giving the repository a ⭐.

---

## 📄 License

This project was developed for **academic and educational purposes**.
