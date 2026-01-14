# TaskNexus Backend

## Overview

TaskNexus is a managed task outsourcing platform backend built with Node.js, Express, and MongoDB. It provides a comprehensive API for managing tasks between clients, freelancers, and admins with features like task assignment, submission tracking, quality assurance, and payment management.

## Features

### Core Functionality

- **User Management**: Support for 3 user roles (Client, Freelancer, Admin)
- **Task Lifecycle Management**: Complete workflow from submission to completion
- **Smart Assignment System**: Automated task assignment to qualified freelancers
- **Quality Assurance**: Built-in QA review process before client delivery
- **Payment Processing**: Escrow system with platform commission handling
- **Notification System**: Real-time notifications for task updates
- **Review & Rating System**: Performance tracking for freelancers
- **Audit Logging**: Complete activity tracking for compliance

### Security Features

- JWT-based authentication with access/refresh tokens
- Role-based access control (RBAC)
- Rate limiting on API endpoints
- Input validation and sanitization
- Password hashing with bcrypt
- HTTP security headers with Helmet
- CORS protection

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet, bcrypt, express-validator
- **Logging**: Winston
- **Development**: Nodemon

## Project Structure

```
backend/
├── server.js                 # Entry point
├── src/
│   ├── app.js               # Express app configuration
│   ├── config/
│   │   ├── constants.js     # Application constants
│   │   ├── database.js      # MongoDB connection
│   │   └── jwt.js           # JWT utilities
│   ├── controllers/         # Request handlers
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── clientController.js
│   │   ├── freelancerController.js
│   │   ├── notificationController.js
│   │   └── taskController.js
│   ├── middleware/          # Custom middleware
│   │   ├── auth.js         # Authentication middleware
│   │   ├── errorHandler.js # Error handling
│   │   ├── rateLimiter.js  # Rate limiting
│   │   ├── roleCheck.js    # Role-based access control
│   │   └── validation.js   # Input validation
│   ├── models/             # Mongoose schemas
│   │   ├── User.js
│   │   ├── Task.js
│   │   ├── Submission.js
│   │   ├── Payment.js
│   │   ├── Review.js
│   │   ├── Notification.js
│   │   └── AuditLog.js
│   ├── routes/             # API routes
│   │   ├── auth.routes.js
│   │   ├── task.routes.js
│   │   ├── client.routes.js
│   │   ├── freelancer.routes.js
│   │   ├── admin.routes.js
│   │   └── notification.routes.js
│   ├── services/           # Business logic
│   │   ├── assignmentService.js
│   │   └── notificationService.js
│   └── utils/              # Helper functions
│       ├── helpers.js
│       ├── logger.js
│       └── validators.js
├── logs/                   # Application logs
├── package.json
└── .env                    # Environment variables
```

## Installation

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- npm or yarn

### Setup Steps

1. **Clone the repository**

   ```bash
   cd backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env` and update the values:

   ```bash
   cp .env.example .env
   ```

   Key environment variables:

   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/tasknexus
   JWT_ACCESS_SECRET=your_access_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   ```

4. **Start MongoDB**

   Make sure MongoDB is running on your system or update the `MONGODB_URI` to point to your MongoDB instance.

5. **Run the server**

   Development mode with auto-reload:

   ```bash
   npm run dev
   ```

   Production mode:

   ```bash
   npm start
   ```

6. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user profile

### Tasks

- `GET /api/tasks` - Get all tasks (role-filtered)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task (Client only)
- `PUT /api/tasks/:id` - Update task (Client only)
- `DELETE /api/tasks/:id` - Cancel task (Client/Admin)
- `POST /api/tasks/:id/submit` - Submit task work (Freelancer)
- `GET /api/tasks/stats` - Get task statistics

### Client

- `GET /api/client/dashboard` - Get client dashboard
- `GET /api/client/tasks` - Get client's tasks
- `POST /api/client/tasks/:id/review` - Review submitted work
- `GET /api/client/payments` - Get payment history

### Freelancer

- `GET /api/freelancer/dashboard` - Get freelancer dashboard
- `GET /api/freelancer/available-tasks` - Get available tasks
- `POST /api/freelancer/tasks/:id/accept` - Accept task
- `GET /api/freelancer/my-tasks` - Get assigned tasks
- `GET /api/freelancer/earnings` - Get earnings summary
- `GET /api/freelancer/reviews` - Get reviews

### Admin

- `GET /api/admin/dashboard` - Get admin dashboard
- `GET /api/admin/users` - Get all users
- `GET /api/admin/tasks` - Get all tasks
- `POST /api/admin/assign` - Manually assign task
- `POST /api/admin/qa-review/:submissionId` - QA review
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/payments` - Get all payments
- `GET /api/admin/analytics` - Get platform analytics

### Notifications

- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Health Check

- `GET /health` - Check server health

## User Roles & Permissions

### Client

- Create and manage tasks
- Review submitted work
- Request revisions
- Approve deliverables
- View payment history

### Freelancer

- View available tasks
- Accept task assignments
- Submit work
- Track earnings
- View performance metrics

### Admin

- Manage all users
- Assign tasks to freelancers
- Perform QA reviews
- Resolve disputes
- View platform analytics
- Access audit logs

## Task Workflow

1. **Client submits task** → Status: `submitted`
2. **Admin reviews** → Status: `under_review`
3. **System/Admin assigns freelancer** → Status: `assigned`
4. **Freelancer accepts** → Status: `in_progress`
5. **Freelancer submits work** → Status: `submitted_work`
6. **Admin QA review** → Status: `qa_review`
   - If rejected → Status: `revision_requested` → Back to step 4
   - If approved → Status: `delivered`
7. **Client reviews** → Status: `delivered`
   - If revision needed → Status: `client_revision` → Back to step 4
   - If approved → Status: `completed`
8. **Payment released** → Task complete

## Environment Variables

| Variable                  | Description               | Default                             |
| ------------------------- | ------------------------- | ----------------------------------- |
| `NODE_ENV`                | Environment mode          | development                         |
| `PORT`                    | Server port               | 5000                                |
| `MONGODB_URI`             | MongoDB connection string | mongodb://localhost:27017/tasknexus |
| `JWT_ACCESS_SECRET`       | JWT access token secret   | (required)                          |
| `JWT_REFRESH_SECRET`      | JWT refresh token secret  | (required)                          |
| `JWT_ACCESS_EXPIRY`       | Access token expiry       | 15m                                 |
| `JWT_REFRESH_EXPIRY`      | Refresh token expiry      | 7d                                  |
| `BCRYPT_SALT_ROUNDS`      | Password hashing rounds   | 12                                  |
| `ALLOWED_ORIGINS`         | CORS allowed origins      | http://localhost:5173               |
| `RATE_LIMIT_WINDOW_MS`    | Rate limit window         | 900000                              |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window   | 100                                 |

## Testing

The health check endpoint can be used to verify the server is running:

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "success": true,
  "message": "TaskNexus API is running",
  "timestamp": "2026-01-15T01:13:47.123Z"
}
```

## Error Handling

The API uses consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}
```

Common error codes:

- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Authentication required or failed
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `DUPLICATE_ERROR` - Resource already exists
- `INTERNAL_SERVER_ERROR` - Server error

## Logging

The application uses Winston for logging with the following levels:

- `error` - Error messages
- `warn` - Warning messages
- `info` - Informational messages
- `debug` - Debug messages (development only)

Logs are stored in:

- `logs/error.log` - Error logs
- `logs/combined.log` - All logs

## Known Issues

⚠️ **Mongoose Schema Index Warnings**: There are duplicate index warnings for email, taskId, and paymentId fields. These are harmless warnings and don't affect functionality, but should be cleaned up by removing duplicate index definitions in the respective model files.

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses nodemon to automatically restart the server when files change.

### Database Seeding

```bash
npm run seed
```

This will populate the database with sample data for testing.

## Security Best Practices

1. **Never commit `.env` file** - Keep secrets out of version control
2. **Use strong JWT secrets** - Generate random, long secrets for production
3. **Enable HTTPS** - Use SSL/TLS in production
4. **Regular updates** - Keep dependencies up to date
5. **Environment-specific configs** - Use different configs for dev/prod
6. **Rate limiting** - Protect against brute force attacks
7. **Input validation** - All user inputs are validated and sanitized

## Contributing

1. Follow the existing code structure
2. Write clear commit messages
3. Add comments for complex logic
4. Update documentation as needed
5. Test your changes before committing

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please open an issue on the repository or contact the development team.

---

**Status**: ✅ Backend is fully functional and ready for development/testing
**Last Updated**: January 15, 2026
