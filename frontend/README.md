# TaskNexus Frontend

Modern React-based frontend for the TaskNexus platform built with Vite, React Router, and Tailwind CSS.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.x
- npm or yarn

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=TaskNexus
VITE_APP_ENV=development
```

4. Start development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 🏗️ Project Structure

````
src/
├── components/          # Reusable components
│   ├── auth/           # Authentication components
│   ├── common/         # Common UI components
│   └── ...
├── context/            # React Context providers
│   └── AuthContext.jsx # Authentication context
├── pages/              # Page components
│   ├── LandingPage.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ClientDashboard.jsx
│   ├── FreelancerDashboard.jsx
│   └── AdminDashboard.jsx
├── services/           # API services
│   ├── api.js         # Axios instance & interceptors
│   └── authService.js # Auth API calls
├── utils/             # Utility functions
│   └── constants.js   # App constants
├── App.jsx            # Main app component
├── main.jsx           # App entry point
└── index.css          # Global styles & Tailwind

## 🎨 Tech Stack

- **React 18.2** - UI library
- **Vite 5.x** - Build tool & dev server
- **React Router 6** - Routing
- **Tailwind CSS 3** - Utility-first CSS
- **Axios** - HTTP client
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library
- **date-fns** - Date utilities

## 🔐 Authentication Flow

1. User logs in via `/login`
2. Access token stored in memory (localStorage)
3. Refresh token stored in httpOnly cookie
4. Axios interceptor adds token to requests
5. Automatic token refresh on 401 responses

## 🎨 Styling

The project uses Tailwind CSS with custom utility classes defined in `index.css`:

### Custom Classes

- **Buttons**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-success`
- **Cards**: `.card`, `.card-header`, `.card-body`, `.card-footer`
- **Inputs**: `.input`, `.input-error`, `.label`
- **Badges**: `.badge`, `.badge-success`, `.badge-warning`, etc.
- **Tables**: `.table`, `.table-header`, `.table-body`, `.table-cell`
- **Loading**: `.spinner`, `.spinner-sm`, `.spinner-lg`

### Theme Colors

Primary color scheme is blue (`primary-*`), with secondary grays and semantic colors for success, warning, danger, etc.

## 📱 Responsive Design

The application is fully responsive and optimized for:
- Mobile devices (< 640px)
- Tablets (640px - 1024px)
- Desktop (> 1024px)

## 🛠️ Development

### Adding New Pages

1. Create component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation links where needed

### Adding API Endpoints

1. Create service in `src/services/`
2. Use the `api` instance from `services/api.js`
3. Add error handling with try-catch

### Environment Variables

All environment variables must be prefixed with `VITE_`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=TaskNexus
````

Access in code:

```javascript
const apiUrl = import.meta.env.VITE_API_URL;
```

## 🚢 Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Build output will be in the `dist/` directory.

## 🔒 Security Best Practices

- Access tokens stored in localStorage (consider memory storage for higher security)
- Refresh tokens in httpOnly cookies
- CORS enabled with credentials
- XSS protection via React's built-in escaping
- Input validation on all forms
- Protected routes with authentication guards

## 🐛 Troubleshooting

### Port Already in Use

If port 5173 is in use, Vite will automatically try the next available port.

### API Connection Issues

- Ensure backend is running on `http://localhost:5000`
- Check CORS settings in backend
- Verify `VITE_API_URL` in `.env`

### Tailwind Classes Not Working

- Ensure Tailwind config includes all file paths
- Restart dev server after config changes
- Check for syntax errors in custom classes

### Build Errors

- Clear `node_modules` and reinstall
- Check for TypeScript errors if using TS
- Verify all imports are correct

## 📄 License

Part of the TaskNexus project.
