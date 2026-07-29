import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Both admin tiers reach the admin area; the read-only tier simply finds the
// write actions absent, and the API rejects them regardless.
export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN" && user.role !== "ADMIN_READONLY") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
