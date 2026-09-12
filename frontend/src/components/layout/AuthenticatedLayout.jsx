import { AuthenticatedAppShell } from './AppShell';

const AuthenticatedLayout = ({ children }) => (
  <div className="authenticated-shell min-h-screen" data-authenticated-shell>
    <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
  </div>
);

export default AuthenticatedLayout;
