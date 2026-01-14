# TaskNexus - Managed Task Outsourcing Platform

> A production-grade SaaS platform where clients submit tasks and receive deliverables without managing freelancers.

## 🎯 Product Overview

**Core Value Proposition:**

- Clients submit tasks and receive final deliverables (ZERO freelancer coordination)
- Platform handles assignment, tracking, quality assurance, and delivery
- Freelancers get clear tasks and steady work
- Admin controls quality, flow, and fairness

**This is NOT a freelancer marketplace.**

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                            │
│  React + Vite + Tailwind CSS (Role-based Dashboards)        │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│     Express.js RESTful API + JWT Auth Middleware            │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                       │
│  Controllers + Services + State Machine + Validators        │
└─────────────────────────────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA ACCESS LAYER                          │
│              MongoDB + Mongoose ODM                          │
└─────────────────────────────────────────────────────────────┘
```

## 🔐 Security Architecture

### Authentication Flow

```
1. User Login → POST /api/auth/login
2. Server validates credentials (bcrypt)
3. Generate JWT access token (15min) + refresh token (7days)
4. Store refresh token in httpOnly cookie
5. Access token sent in response body
6. Client stores access token in memory (not localStorage)
7. Include access token in Authorization header
8. Refresh token rotation on renewal
```

### Authorization (RBAC)

- **Client**: Can only access own tasks, submit requests, approve deliverables
- **Freelancer**: Can only see assigned tasks, submit work, view earnings
- **Admin**: Full platform access, task assignment, QA, user management

### Security Measures

- bcrypt password hashing (salt rounds: 12)
- JWT with short expiration
- Refresh token rotation
- Rate limiting on auth endpoints
- Input validation and sanitization
- MongoDB injection prevention
- CORS configuration
- Helmet.js security headers
- Environment variable protection

## 📊 Database Design

### Collections

#### Users

```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  password: String (hashed),
  role: Enum ['client', 'freelancer', 'admin'],
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    avatar: String
  },
  // Freelancer-specific
  freelancerProfile: {
    skills: [String],
    experience: Number,
    availability: String,
    performanceScore: Number (0-100),
    completedTasks: Number,
    rating: Number
  },
  // Client-specific
  clientProfile: {
    company: String,
    totalTasksSubmitted: Number
  },
  status: Enum ['active', 'suspended', 'blocked'],
  refreshToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

#### Tasks

```javascript
{
  _id: ObjectId,
  taskId: String (unique, auto-generated),
  client: ObjectId (ref: User),
  freelancer: ObjectId (ref: User),
  assignedBy: ObjectId (ref: User - admin),

  taskDetails: {
    title: String,
    type: Enum ['video-editing', 'web-development', 'design', 'writing', 'other'],
    description: String,
    requirements: String,
    attachments: [String], // URLs
    deadline: Date,
    budget: Number,
    revisionLimit: Number (default: 2)
  },

  status: Enum [
    'submitted',       // Client submitted
    'under_review',    // Admin reviewing
    'assigned',        // Assigned to freelancer
    'in_progress',     // Freelancer working
    'submitted_work',  // Freelancer submitted
    'qa_review',       // Admin QA
    'revision_requested', // Need changes
    'delivered',       // Sent to client
    'client_revision', // Client wants changes
    'completed',       // Client approved
    'cancelled',       // Cancelled
    'disputed'         // In dispute
  ],

  workflow: {
    submittedAt: Date,
    reviewedAt: Date,
    assignedAt: Date,
    startedAt: Date,
    submittedWorkAt: Date,
    qaCompletedAt: Date,
    deliveredAt: Date,
    completedAt: Date
  },

  metrics: {
    revisionsUsed: Number,
    reassignmentCount: Number,
    actualCompletionTime: Number // hours
  },

  priority: Enum ['low', 'medium', 'high', 'urgent'],
  tags: [String],

  createdAt: Date,
  updatedAt: Date
}
```

#### Submissions

```javascript
{
  _id: ObjectId,
  task: ObjectId (ref: Task),
  freelancer: ObjectId (ref: User),
  submissionType: Enum ['initial', 'revision'],

  content: {
    description: String,
    deliverables: [String], // URLs
    notes: String
  },

  qaReview: {
    reviewer: ObjectId (ref: User - admin),
    status: Enum ['pending', 'approved', 'rejected'],
    feedback: String,
    reviewedAt: Date
  },

  clientReview: {
    status: Enum ['pending', 'approved', 'revision_requested'],
    feedback: String,
    reviewedAt: Date
  },

  version: Number,
  createdAt: Date,
  updatedAt: Date
}
```

#### Payments

```javascript
{
  _id: ObjectId,
  paymentId: String (unique),
  task: ObjectId (ref: Task),
  client: ObjectId (ref: User),
  freelancer: ObjectId (ref: User),

  amounts: {
    taskBudget: Number,
    platformCommission: Number, // percentage
    platformFee: Number, // calculated
    freelancerPayout: Number // calculated
  },

  status: Enum ['pending', 'escrowed', 'released', 'refunded'],

  escrow: {
    heldAt: Date,
    releaseScheduled: Date,
    releasedAt: Date
  },

  transactionDetails: {
    paymentMethod: String,
    transactionId: String,
    gateway: String // future: 'stripe'
  },

  createdAt: Date,
  updatedAt: Date
}
```

#### Reviews

```javascript
{
  _id: ObjectId,
  task: ObjectId (ref: Task),
  reviewer: ObjectId (ref: User),
  reviewee: ObjectId (ref: User),
  reviewType: Enum ['client_to_platform', 'platform_to_freelancer'],

  rating: Number (1-5),
  feedback: String,

  createdAt: Date,
  updatedAt: Date
}
```

#### Notifications

```javascript
{
  _id: ObjectId,
  recipient: ObjectId (ref: User),
  type: Enum [
    'task_assigned',
    'task_submitted',
    'qa_feedback',
    'client_approval',
    'revision_requested',
    'payment_released',
    'deadline_reminder'
  ],

  content: {
    title: String,
    message: String,
    actionUrl: String
  },

  relatedTask: ObjectId (ref: Task),

  status: Enum ['unread', 'read'],
  priority: Enum ['low', 'medium', 'high'],

  createdAt: Date,
  readAt: Date
}
```

#### AuditLogs

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  action: String,
  resource: String,
  resourceId: ObjectId,
  changes: Object,
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
```

### Indexes

```javascript
// Users
- email (unique)
- role
- status
- 'freelancerProfile.performanceScore' (for assignment logic)

// Tasks
- taskId (unique)
- client
- freelancer
- status
- 'taskDetails.deadline'
- createdAt

// Submissions
- task
- freelancer
- 'qaReview.status'

// Payments
- paymentId (unique)
- task
- status

// Notifications
- recipient + status (compound)
- createdAt
```

## 🔄 Task Workflow State Machine

```
                    ┌──────────────┐
                    │   SUBMITTED  │ (Client creates task)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ UNDER_REVIEW │ (Admin reviews task)
                    └──────┬───────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
         [Reject/Cancel]      ┌──────────────┐
                              │   ASSIGNED   │ (Admin assigns to freelancer)
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ IN_PROGRESS  │ (Freelancer working)
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │SUBMITTED_WORK│ (Freelancer submits)
                              └──────┬───────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │  QA_REVIEW   │ (Admin quality check)
                              └──────┬───────┘
                                     │
                        ┌────────────┼────────────┐
                        │                         │
                        ▼                         ▼
                 [QA Rejected]            ┌──────────────┐
                  (Revision or            │  DELIVERED   │ (Sent to client)
                   Reassign)              └──────┬───────┘
                        │                        │
                        │                        ▼
                        │                 ┌──────────────┐
                        │                 │Client Reviews│
                        │                 └──────┬───────┘
                        │                        │
                        │              ┌─────────┼─────────┐
                        │              │                   │
                        │              ▼                   ▼
                        │      [Client Approves]   [Revision Request]
                        │              │                   │
                        │              ▼                   ▼
                        │      ┌──────────────┐   ┌──────────────┐
                        │      │  COMPLETED   │   │CLIENT_REVISION│
                        │      └──────────────┘   └──────┬───────┘
                        │                                │
                        └────────────────────────────────┘
                                (Back to IN_PROGRESS)
```

### State Transition Rules

| Current State      | Allowed Next States                       | Who Can Transition |
| ------------------ | ----------------------------------------- | ------------------ |
| submitted          | under_review, cancelled                   | Admin              |
| under_review       | assigned, cancelled                       | Admin              |
| assigned           | in_progress, reassigned                   | Freelancer, Admin  |
| in_progress        | submitted_work                            | Freelancer         |
| submitted_work     | qa_review                                 | System (automatic) |
| qa_review          | delivered, revision_requested, reassigned | Admin              |
| revision_requested | in_progress                               | System (automatic) |
| delivered          | completed, client_revision, disputed      | Client             |
| client_revision    | in_progress                               | System (automatic) |
| completed          | -                                         | Final State        |
| cancelled          | -                                         | Final State        |
| disputed           | qa_review                                 | Admin              |

## 🛣️ API Route Structure

### Authentication Routes

```
POST   /api/auth/register           - Register new user
POST   /api/auth/login              - Login (returns access + refresh token)
POST   /api/auth/refresh            - Refresh access token
POST   /api/auth/logout             - Logout (invalidate refresh token)
POST   /api/auth/forgot-password    - Request password reset
POST   /api/auth/reset-password     - Reset password with token
GET    /api/auth/me                 - Get current user info
```

### Client Routes

```
GET    /api/client/dashboard        - Client dashboard stats
POST   /api/client/tasks            - Create new task
GET    /api/client/tasks            - Get all client's tasks
GET    /api/client/tasks/:id        - Get specific task details
PATCH  /api/client/tasks/:id/approve - Approve final delivery
PATCH  /api/client/tasks/:id/revision - Request revision
GET    /api/client/payments         - Get payment history
GET    /api/client/invoices         - Get invoices
POST   /api/client/reviews          - Submit platform review
```

### Freelancer Routes

```
GET    /api/freelancer/dashboard    - Freelancer dashboard stats
GET    /api/freelancer/profile      - Get freelancer profile
PUT    /api/freelancer/profile      - Update freelancer profile
GET    /api/freelancer/tasks        - Get assigned tasks
GET    /api/freelancer/tasks/:id    - Get task details
PATCH  /api/freelancer/tasks/:id/accept - Accept task
PATCH  /api/freelancer/tasks/:id/reject - Reject task
POST   /api/freelancer/tasks/:id/submit - Submit work
GET    /api/freelancer/earnings     - Get earnings history
GET    /api/freelancer/performance  - Get performance metrics
```

### Admin Routes

```
GET    /api/admin/dashboard         - Admin dashboard with analytics
GET    /api/admin/tasks             - Get all tasks (with filters)
GET    /api/admin/tasks/:id         - Get task details
PATCH  /api/admin/tasks/:id/review  - Review submitted task
POST   /api/admin/tasks/:id/assign  - Assign task to freelancer
POST   /api/admin/tasks/:id/reassign - Reassign task
PATCH  /api/admin/submissions/:id/qa - QA review submission
GET    /api/admin/users             - Get all users (with filters)
GET    /api/admin/users/:id         - Get user details
PATCH  /api/admin/users/:id/status  - Update user status (suspend/block)
GET    /api/admin/freelancers       - Get all freelancers with metrics
GET    /api/admin/analytics         - Platform analytics
POST   /api/admin/disputes/:id/resolve - Resolve dispute
GET    /api/admin/payments          - Get all payments
PATCH  /api/admin/settings          - Update platform settings
```

### Shared Routes

```
GET    /api/notifications           - Get user notifications
PATCH  /api/notifications/:id/read  - Mark notification as read
PATCH  /api/notifications/read-all  - Mark all as read
POST   /api/upload                  - Upload file (task attachments/deliverables)
```

## 🏭 Business Logic Rules

### Task Assignment Logic

1. **Skill Matching**: Match task type with freelancer skills
2. **Performance Score**: Prioritize freelancers with score > 70
3. **Availability**: Check freelancer's current workload
4. **Past Performance**: Consider completion rate and ratings
5. **Workload Balancing**: Distribute tasks fairly

```javascript
Assignment Priority Score =
  (Performance Score * 0.4) +
  (Skill Match * 0.3) +
  (Availability * 0.2) +
  (Past Completion Rate * 0.1)
```

### Payment & Escrow Logic

```javascript
Platform Commission: 15% (configurable by admin)

Task Budget: $100
Platform Fee: $15
Freelancer Payout: $85

Payment Flow:
1. Client pays $100 → Escrowed
2. Task completed → Admin releases payment
3. Platform keeps $15
4. Freelancer receives $85
```

### Revision Rules

- Default revision limit: 2 per task
- Each revision extends deadline by 48 hours
- After revision limit: admin intervention required
- Unlimited revisions incur additional charges

### Deadline Management

- Deadline warning: 24 hours before
- Overdue penalty: -5 performance score
- 3 missed deadlines: temporary suspension
- Client can extend deadline (one-time, max 48 hours)

### Performance Score Calculation

```javascript
Performance Score (0-100) =
  (On-time Completion Rate * 40) +
  (First-time Approval Rate * 30) +
  (Client Satisfaction * 20) +
  (Admin QA Pass Rate * 10)
```

### Quality Assurance Rules

- All submissions go through admin QA
- QA must complete within 12 hours
- 3 failed QA = task reassignment
- Auto-reassignment after 2nd revision failure

### Dispute Handling

1. Client or freelancer raises dispute
2. Task status → 'disputed'
3. Payment held in escrow
4. Admin investigates (48-hour SLA)
5. Admin decision is final
6. Payment released or refunded based on decision

## 📁 Project Structure

```
TaskNexus/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   ├── jwt.js
│   │   │   └── constants.js
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── Task.js
│   │   │   ├── Submission.js
│   │   │   ├── Payment.js
│   │   │   ├── Review.js
│   │   │   ├── Notification.js
│   │   │   └── AuditLog.js
│   │   ├── middleware/
│   │   │   ├── auth.js
│   │   │   ├── roleCheck.js
│   │   │   ├── validation.js
│   │   │   ├── errorHandler.js
│   │   │   └── rateLimiter.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── clientController.js
│   │   │   ├── freelancerController.js
│   │   │   ├── adminController.js
│   │   │   └── notificationController.js
│   │   ├── services/
│   │   │   ├── taskService.js
│   │   │   ├── assignmentService.js
│   │   │   ├── paymentService.js
│   │   │   ├── notificationService.js
│   │   │   ├── performanceService.js
│   │   │   └── emailService.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── client.routes.js
│   │   │   ├── freelancer.routes.js
│   │   │   ├── admin.routes.js
│   │   │   └── notification.routes.js
│   │   ├── utils/
│   │   │   ├── validators.js
│   │   │   ├── helpers.js
│   │   │   └── logger.js
│   │   └── app.js
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── Navbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   ├── Table.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   └── Card.jsx
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.jsx
│   │   │   │   ├── RegisterForm.jsx
│   │   │   │   └── ProtectedRoute.jsx
│   │   │   ├── client/
│   │   │   │   ├── ClientDashboard.jsx
│   │   │   │   ├── CreateTask.jsx
│   │   │   │   ├── TaskList.jsx
│   │   │   │   ├── TaskDetails.jsx
│   │   │   │   └── PaymentHistory.jsx
│   │   │   ├── freelancer/
│   │   │   │   ├── FreelancerDashboard.jsx
│   │   │   │   ├── ProfileSetup.jsx
│   │   │   │   ├── AssignedTasks.jsx
│   │   │   │   ├── SubmitWork.jsx
│   │   │   │   └── Earnings.jsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.jsx
│   │   │       ├── TaskManagement.jsx
│   │   │       ├── AssignTask.jsx
│   │   │       ├── QAReview.jsx
│   │   │       ├── UserManagement.jsx
│   │   │       ├── Analytics.jsx
│   │   │       └── PlatformSettings.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── NotificationContext.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useTask.js
│   │   │   └── useNotification.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── taskService.js
│   │   │   └── uploadService.js
│   │   ├── utils/
│   │   │   ├── constants.js
│   │   │   ├── helpers.js
│   │   │   └── validators.js
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── ClientDashboard.jsx
│   │   │   ├── FreelancerDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── NotFound.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.example
│   ├── .gitignore
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
│
└── README.md
```

## 🚀 MVP vs Phase-2 Features

### MVP (Launch Ready)

✅ User authentication (all 3 roles)
✅ Client: Create task, track status, approve delivery
✅ Freelancer: View assigned tasks, submit work
✅ Admin: Assign tasks, QA review, user management
✅ Task workflow state machine
✅ Mock escrow payment system
✅ Basic notifications
✅ Performance scoring
✅ Revision handling (up to 2)
✅ File upload/download
✅ Role-based dashboards

### Phase-2 (Growth)

🔄 Real Stripe payment integration
🔄 Advanced AI task assignment (ML model)
🔄 Real-time chat (Socket.io)
🔄 Video call integration for disputes
🔄 Advanced analytics & reporting
🔄 Freelancer application system
🔄 Multi-currency support
🔄 Mobile app (React Native)
🔄 Email notifications (SendGrid)
🔄 SMS alerts (Twilio)
🔄 Advanced search & filters
🔄 Bulk task upload
🔄 API for third-party integrations
🔄 White-label solution

## 🤖 Future AI Integration Points

1. **Smart Task Assignment**

   - ML model trained on past assignments
   - Predict best freelancer match
   - Optimize for completion time + quality

2. **Quality Prediction**

   - Analyze submission before admin QA
   - Flag potential quality issues
   - Suggest improvements

3. **Dynamic Pricing**

   - AI-based budget recommendations
   - Market rate analysis
   - Demand-based pricing

4. **Fraud Detection**

   - Detect suspicious patterns
   - Flag duplicate submissions
   - Identify fake accounts

5. **Automated QA Assistance**
   - Pre-screen deliverables
   - Check for completeness
   - Validate against requirements

## 🔒 Security Checklist

- [ ] Environment variables for sensitive data
- [ ] bcrypt password hashing (salt rounds: 12)
- [ ] JWT with short expiration (15min access, 7d refresh)
- [ ] Refresh token rotation
- [ ] httpOnly cookies for refresh tokens
- [ ] CORS whitelist
- [ ] Helmet.js security headers
- [ ] Rate limiting (express-rate-limit)
- [ ] Input validation (Joi/express-validator)
- [ ] MongoDB injection prevention
- [ ] XSS protection
- [ ] CSRF tokens (for state-changing operations)
- [ ] File upload validation (size, type, scan)
- [ ] API request logging
- [ ] Audit trail for critical actions
- [ ] Role-based access control enforcement
- [ ] Session management
- [ ] SQL injection prevention (N/A - using MongoDB)

## 📈 Scalability Considerations

### Database

- Implement database connection pooling
- Use MongoDB indexes strategically
- Consider sharding for horizontal scaling
- Archive old completed tasks
- Implement caching layer (Redis)

### API

- Implement API versioning (/api/v1/)
- Use load balancer (Nginx)
- Implement CDN for static assets
- API response pagination
- Background job queue (Bull/Redis)

### Frontend

- Code splitting and lazy loading
- Optimize bundle size
- Implement service worker (PWA)
- Image optimization
- Skeleton loaders for better UX

### Monitoring

- Application Performance Monitoring (APM)
- Error tracking (Sentry)
- Log aggregation (Winston + CloudWatch)
- Uptime monitoring
- Database query performance tracking

## 🧪 Testing Strategy

### Backend

- Unit tests (Jest)
- Integration tests (Supertest)
- API contract tests
- Load testing (Artillery)

### Frontend

- Component tests (React Testing Library)
- E2E tests (Playwright)
- Accessibility tests
- Visual regression tests

## 📦 Deployment Strategy

### Development

```
- Local MongoDB
- Node.js dev server (nodemon)
- Vite dev server (HMR)
```

### Staging

```
- MongoDB Atlas
- Heroku/Railway (backend)
- Vercel (frontend)
- Environment: staging
```

### Production

```
- MongoDB Atlas (Production cluster)
- AWS EC2/ECS (backend)
- Cloudflare + S3 (frontend)
- CI/CD: GitHub Actions
- Monitoring: Datadog
```

## 🎓 Resume Highlight Points

✨ **Built production-grade SaaS platform with 100K+ users potential**
✨ **Implemented secure JWT authentication with refresh token rotation**
✨ **Designed complex state machine for task workflow management**
✨ **Built escrow payment system ready for Stripe integration**
✨ **Implemented role-based access control (RBAC) across 3 user types**
✨ **Created intelligent task assignment algorithm with ML readiness**
✨ **Architected scalable MongoDB schema with proper indexing**
✨ **Built RESTful API with 30+ endpoints following best practices**
✨ **Implemented comprehensive audit logging and security measures**
✨ **Designed responsive SaaS UI with Tailwind CSS**

---

**Built by a senior startup CTO mindset | Production-ready | Scalable | Secure**
