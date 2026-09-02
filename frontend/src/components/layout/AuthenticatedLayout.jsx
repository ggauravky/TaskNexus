const AuthenticatedLayout = ({ children }) => (
  <div className="authenticated-shell min-h-screen" data-authenticated-shell>
    {children}
  </div>
);

export default AuthenticatedLayout;
