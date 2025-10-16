# Cashback Management System

## Overview

This is a full-stack cashback management application built with Express.js and React. The system allows users to submit purchase bills for verification and receive cashback coupons. Administrators can verify purchases, generate cashback coupons, and manage users. The application features session-based authentication with role-based access control (user/admin).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript
- **Routing:** Wouter (lightweight client-side router)
- **State Management:** TanStack Query (React Query) for server state
- **Form Handling:** React Hook Form with Zod validation
- **UI Components:** Radix UI primitives with custom styling
- **Styling:** Tailwind CSS with shadcn/ui design system

**Key Design Patterns:**
- Component-based architecture with reusable UI primitives
- Protected routes using authentication context
- Centralized API communication through query client
- Form validation using Zod schemas shared between frontend and backend

**Rationale:**
The frontend uses modern React patterns with TypeScript for type safety. TanStack Query handles server state caching and synchronization, eliminating the need for complex state management. Wouter provides lightweight routing without the overhead of React Router. The shadcn/ui component library offers accessible, customizable components built on Radix UI.

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database ORM:** Drizzle ORM
- **Authentication:** Passport.js with Local Strategy
- **Session Management:** Express Session with configurable stores

**Core Components:**

1. **Authentication System** (`server/auth.ts`)
   - Uses Passport Local Strategy for username/password authentication
   - Password hashing with scrypt for security
   - Session-based authentication with secure cookie storage
   - Role-based access control (admin vs. regular users)

2. **Storage Layer** (`server/storage.ts`)
   - Abstraction layer with `IStorage` interface
   - In-memory implementation (`MemStorage`) for development
   - Supports migration to database-backed storage
   - Handles users, purchases, cashback coupons, and notifications

3. **API Routes** (`server/routes.ts`)
   - RESTful endpoints for purchases, coupons, and user management
   - Authentication middleware protecting sensitive routes
   - Admin-only endpoints for verification and statistics

**Rationale:**
Express provides a minimal, flexible backend framework. The storage abstraction allows switching between in-memory (development) and database (production) implementations without changing business logic. Session-based authentication is simpler than JWT for this use case and works well with server-side rendering.

### Data Models

**Database Schema** (`shared/schema.ts`):

1. **Users Table:**
   - Stores user credentials and profile information
   - `isAdmin` flag for role-based access
   - Password stored as hashed value with salt

2. **Purchases Table:**
   - Tracks user purchase submissions
   - Contains bill number, amount, and purchase date
   - Verification status workflow (pending → verified)
   - Foreign key relationship to users

3. **Cashback Coupons Table:**
   - Generated after purchase verification
   - Unique coupon codes for redemption
   - One-to-one relationship with purchases
   - Status tracking (active/redeemed)

4. **Notifications Table:**
   - User notification system
   - Read/unread status tracking
   - Foreign key relationship to users

**Validation:**
Zod schemas provide runtime type validation and are shared between client and server, ensuring data consistency across the full stack.

### Authentication & Authorization

**Authentication Flow:**
1. User submits credentials via login form
2. Passport Local Strategy validates against stored user data
3. Password compared using timing-safe comparison
4. Session created and stored in configured session store
5. Session cookie returned to client

**Authorization:**
- Protected routes check `req.user` for authentication
- Admin routes verify `req.user.isAdmin` flag
- Frontend uses `AuthContext` and `ProtectedRoute` component
- Unauthenticated users redirected to `/auth` page

**Security Considerations:**
- Passwords hashed with scrypt (64-byte derived key)
- Timing-safe password comparison prevents timing attacks
- Session secret from environment variable or auto-generated
- CSRF protection through session middleware

## External Dependencies

### Database
- **Neon PostgreSQL** via `@neondatabase/serverless`
  - Serverless PostgreSQL database
  - WebSocket support for real-time connections
  - Connection pooling for performance
  - Configured via `DATABASE_URL` environment variable

### ORM & Migrations
- **Drizzle ORM** (`drizzle-orm`)
  - Type-safe SQL queries with TypeScript
  - Schema defined in `shared/schema.ts`
  - Migrations output to `./migrations` directory
  - Push-based schema synchronization with `db:push` script

### Session Storage
- **connect-pg-simple** - PostgreSQL session store for Express Session
  - Persists sessions in database
  - Automatic cleanup of expired sessions
  - Configurable via session store in storage layer

### UI Component Libraries
- **Radix UI** - Headless UI primitives for accessibility
  - Comprehensive component collection (dialogs, dropdowns, tooltips, etc.)
  - Keyboard navigation and ARIA support
  - Unstyled components styled with Tailwind

### Build Tools
- **Vite** - Frontend build tool and dev server
  - Fast HMR (Hot Module Replacement)
  - Optimized production builds
  - Custom plugin for shadcn theme JSON support
  - Development error overlay via Replit plugin

- **esbuild** - Backend bundler
  - Fast TypeScript compilation
  - ESM output for Node.js
  - External package handling for node_modules

### Development Tools
- **tsx** - TypeScript execution for development server
- **TypeScript** - Type checking and compilation
- **Tailwind CSS** - Utility-first CSS framework with PostCSS