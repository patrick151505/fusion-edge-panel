import { useCallback, useEffect, useState } from "react";
import { listUsers, type AdminUser } from "../lib/users";

/** Loads the admin user list (admin_users view). Empty for non-admins. */
export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { users, error } = await listUsers();
    setUsers(users);
    setError(error);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { users, loading, error, reload: load };
}
