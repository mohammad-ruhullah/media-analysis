import { requireRole } from "@/lib/session";
import { listUsers } from "@/lib/data";
import { createUser, setUserRoles, resetPassword, toggleUserActive } from "@/app/actions";

const ALL_ROLES = ["admin", "analyst", "editor"] as const;

export default async function AdminUsers() {
  await requireRole(["admin"]);
  const users = await listUsers();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Users &amp; Roles</h1>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-3 font-medium">Create user</h2>
        <form action={createUser} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input name="fullName" placeholder="Full name"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <input name="email" type="email" required placeholder="Email"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <input name="password" required placeholder="Password"
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2" />
          <div className="sm:col-span-3 flex flex-wrap gap-4">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm capitalize">
                <input type="checkbox" name="roles" value={r} /> {r}
              </label>
            ))}
          </div>
          <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 sm:col-span-3">
            Create user
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">
                  {u.full_name || "—"}{" "}
                  {!u.is_active ? <span className="text-xs text-red-400">(disabled)</span> : null}
                </div>
                <div className="text-sm text-slate-400">{u.email}</div>
              </div>
              <form action={toggleUserActive}>
                <input type="hidden" name="userId" value={u.id} />
                <button className="rounded border border-slate-700 px-3 py-1 text-xs hover:bg-slate-800">
                  {u.is_active ? "Disable" : "Enable"}
                </button>
              </form>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <form action={setUserRoles} className="flex flex-wrap items-center gap-4">
                <input type="hidden" name="userId" value={u.id} />
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm capitalize">
                    <input type="checkbox" name="roles" value={r} defaultChecked={u.roles.includes(r)} />
                    {r}
                  </label>
                ))}
                <button className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
                  Save roles
                </button>
              </form>

              <form action={resetPassword} className="flex items-center gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <input name="password" placeholder="New password"
                  className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-1 text-sm" />
                <button className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600">
                  Reset password
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}