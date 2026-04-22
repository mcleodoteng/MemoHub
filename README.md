# MemoHub

MemoHub is an internal memo and communications platform for teams. The project includes a React frontend for the user interface and a Node.js/Express backend for authentication, memo workflows, notifications, reporting, file uploads, and realtime updates.

## Repository Structure

- `src/`: frontend application source
- `public/`: static frontend assets
- `backend/`: API server, Prisma schema, and backend services

## Frontend Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Radix UI
- React Query
- Socket.IO client

## Backend Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- MySQL
- Socket.IO

## Local Development

## Requirements

- Node.js 20+
- npm
- MySQL

## Frontend Setup

```sh
npm install
npm run dev
```

The frontend runs on `http://localhost:8080` by default.

## Backend Setup

```sh
cd backend
npm install
cp .env.example .env
npm run dev
```

The backend runs on `http://localhost:5000` by default.

## Production Build

## Frontend

```sh
npm run build
```

## Backend

```sh
cd backend
npm run build
npm run start:prod
```

## Main Features

- Memo creation, editing, pinning, archiving, and deletion
- Public, private, and protected memo visibility
- Workflow approvals with comments and escalations
- Memo comments, replies, reactions, and activity history
- Group-based collaboration and messaging
- Reporting and printable memo/report outputs
- Notifications, reminders, and realtime sync
- Role-based access control for administration and reporting

## Environment Notes

- Frontend API requests are proxied to the backend during local development.
- Backend environment variables should be configured in `backend/.env`.
- Do not commit secrets or production credentials.

## Deployment

Deploy the frontend and backend as separate services, or behind a reverse proxy, with the backend connected to a production MySQL database and the frontend configured to reach the backend API and Socket.IO endpoints.
