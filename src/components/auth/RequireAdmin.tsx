import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../context/AuthContext";

/**
 * Gate for admin-only routes. Every catalogue write is blocked by RLS
 * unless the signed-in user has profiles.is_admin — this mirrors that in
 * the UI so non-admins never reach an editor that would just fail to save.
 */
export default function RequireAdmin() {
  const { session, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-gray-500 dark:text-gray-400">Checking access…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center border border-gray-200 rounded-2xl bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <h4 className="mb-1 font-medium text-gray-800 dark:text-white/90">
          Admin access required
        </h4>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Your account is signed in but is not an admin, so editing is
          disabled. A project owner must grant admin in the database.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
