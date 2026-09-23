# AI-Powered School Management System (SaaS)

A comprehensive, multi-tenant school management platform built with modern technologies and AI capabilities.

## 🚀 Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- Material UI (MUI)
- React Router
- React Query (TanStack Query)
- Axios
- React Hook Form
- Zod Validation
- Recharts
- React PDF
- XLSX Export
- Firebase Client SDK

### Backend
- NestJS
- Firebase Admin SDK (Firestore, Auth, Storage)
- Redis
- BullMQ
- JWT Authentication
- Refresh Tokens
- Swagger
- OpenAI API
- Firebase Storage
- Nodemailer
- Twilio (SMS)
- WhatsApp Cloud API

### Infrastructure
- Docker
- Nginx
- GitHub Actions CI/CD
- Railway/AWS/GCP
- Cloudflare CDN
- Sentry Monitoring

## 📁 Project Structure

```
school-management-saas/
├── apps/
│   ├── web/                 # React + Vite frontend
│   └── api/                 # NestJS backend
├── packages/
│   ├── ui/                  # Shared React components
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utilities
│   └── config/              # Shared configs
├── docker/
├── FIRESTORE_SCHEMA.md      # Firestore database schema documentation
├── .github/workflows/
└── README.md
```

## 🏗️ Multi-Tenant Architecture

Each school operates as an isolated tenant with complete data separation:
- Every request includes `schoolId`
- All database queries are filtered by `schoolId`
- No school can access another school's data

## 👥 User Roles

- **Super Admin**: Manage all schools, billing, SaaS settings
- **School Owner**: Full access to school data
- **Principal**: Academic management
- **Vice Principal**: Academic supervision
- **Accountant**: School fees, financial reports
- **Teacher**: Attendance, results, assignments
- **Parent**: Child progress, fees, notifications
- **Student**: Results, attendance, assignments

## 🤖 AI Features

- **AI Report Card Comments**: Auto-generate personalized comments
- **Academic Risk Prediction**: Identify at-risk students
- **Natural Language Search**: Query data in plain English
- **AI Fee Reminders**: Automated payment reminders
- **AI Academic Insights**: Performance analytics

## 📦 Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up Firebase project:
   - Create a Firebase project at https://console.firebase.google.com
   - Enable Firestore Database
   - Enable Authentication
   - Enable Storage
   - Generate service account key (for backend)
   - Get Firebase config (for frontend)

4. Set up environment variables:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

5. Configure Firebase credentials:
   - Add Firebase Admin SDK credentials to `apps/api/.env`
   - Add Firebase Client config to `apps/web/.env`

6. Start development servers:
```bash
npm run dev
```

## 🚢 Deployment

### Docker
```bash
npm run docker:build
npm run docker:up
```

### CI/CD
GitHub Actions workflow configured for automated deployment.

## 🔐 Security

- JWT with Refresh Tokens
- Role-Based Access Control (RBAC)
- Tenant Isolation
- Password Hashing
- Rate Limiting
- SQL Injection Protection
- XSS Protection
- CSRF Protection
- Encryption
- Secure File Upload
- Audit Logging

## 📊 Modules

- Authentication & Authorization
- Dashboard & Analytics
- Student Management
- Admissions
- Teacher Management
- Staff Management
- Classes & Subjects
- Attendance
- Examinations
- Results
- Fees & Payments
- Parent Portal
- Notifications
- Settings

## 📝 License

Proprietary - All rights reserved
