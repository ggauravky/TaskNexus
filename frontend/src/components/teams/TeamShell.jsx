import { AppShellFrame, useEmbeddedAppShell } from "../layout/AppShell";

const TeamShell = ({ children }) => {
  const embedded = useEmbeddedAppShell();
  if (embedded) return children;
  return <AppShellFrame>{children}</AppShellFrame>;
};

export default TeamShell;
