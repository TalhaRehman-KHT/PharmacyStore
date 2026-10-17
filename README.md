# PharmacyStore

A full-stack online pharmacy platform with separate customer and vendor experiences, secure payments, and **MedAssist**, an AI-powered medicine-information assistant. Built as a Final Year Project and deployed on AWS with a containerized, continuously delivered pipeline.

**Live demo:** https://d2a0oi7jgr4hty.cloudfront.net

---

## Features

**Customer side**
- Browse and search medicines and pharmacy products
- Cart, checkout, and online payments via Stripe
- Account management and order history
- MedAssist chat widget and dedicated `/assistant` page for medicine-information queries

**Vendor side**
- Product and inventory management
- Order management
- `/vendor/escalations` view for queries that MedAssist hands off to a human

**MedAssist (AI assistant)**
- Retrieval-Augmented Generation (RAG) over a curated set of drug documents
- FastAPI backend located in `medassist-api/`
- LLM providers: Gemini and Groq

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | JavaScript, React |
| Backend / Database | Supabase (PostgreSQL, Auth) |
| Payments | Stripe |
| AI Service | Python, FastAPI, Gemini, Groq |
| Containerization | Docker |
| Cloud | AWS ECR, ECS, CloudFront |
| CI/CD | GitHub Actions (manual-approval production environment) |

---

## Project Structure

```
PharmacyStore/
├── <frontend-folder>/     # Web application
├── medassist-api/         # FastAPI service for the MedAssist RAG assistant
├── <sql-folder>/          # SQL files to rebuild the Supabase database
├── .github/workflows/     # CI/CD pipeline
└── README.md
```

> Replace the placeholder folder names above with the actual names in the repository.

---

## Getting Started

### Prerequisites
- Node.js (v18 or later)
- Python 3.10 or later (for MedAssist)
- Docker
- A Supabase project, a Stripe account, and Gemini / Groq API keys

### 1. Clone the repository
```bash
git clone https://github.com/TalhaRehman-KHT/PharmacyStore.git
cd PharmacyStore
```

### 2. Set up the database
Create a new Supabase project and run the SQL files from `<sql-folder>/` in the Supabase SQL editor to recreate the schema and policies.

### 3. Configure environment variables
Copy the example file and fill in your own keys:
```bash
cp .env.example .env
```
Required keys include the Supabase URL and anon key, the Stripe keys, and the Gemini / Groq API keys. Never commit `.env` files.

### 4. Run the web app
```bash
cd <frontend-folder>
npm install
npm run dev
```

### 5. Run MedAssist
```bash
cd medassist-api
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## Deployment

The application is containerized with Docker and deployed on AWS:

1. GitHub Actions builds the Docker images on push.
2. Images are pushed to Amazon ECR.
3. After manual approval in the `production` environment, the workflow redeploys the services on Amazon ECS.
4. The frontend is served through Amazon CloudFront.

---

## Roadmap

- [ ] Deploy MedAssist API through the existing CD pipeline
- [ ] LangGraph-based agent with a full safety guard for MedAssist
- [ ] Low-stock alerts that draft supplier emails, with human-in-the-loop approval before sending
- [ ] Order-status emails for buyers (placed, shipped, delivered)
- [ ] Flutter mobile app

---

## Disclaimer

MedAssist provides general medicine information only. It is not a substitute for professional medical advice, diagnosis, or treatment.

---

## Author

**Talha Rehman**
- Portfolio: [talha-five.vercel.app](https://talha-five.vercel.app)
- GitHub: [@TalhaRehman-KHT](https://github.com/TalhaRehman-KHT)
- LinkedIn: [talha-rehman](https://linkedin.com/in/talha-rehman-460014218)
