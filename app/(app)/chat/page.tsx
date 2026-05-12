import { redirect } from "next/navigation";
import ChatClient from "./chat-client";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser, isMaintenanceMode } from "@/lib/admin";

function MaintenanceScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#e6edf5] px-5 text-center">
      <div className="max-w-sm rounded-[2rem] bg-white p-7 shadow-2xl shadow-slate-900/10">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#229ed9]/10 text-3xl">🛠️</div>
        <h1 className="text-2xl font-black tracking-[-0.03em] text-slate-950">Закрыто на тех обслуживание</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Админ обновляет Pirogram. Приложение снова откроется автоматически, когда обслуживание завершится.</p>
      </div>
    </main>
  );
}

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const maintenanceMode = await isMaintenanceMode();
  const isAdmin = isAdminUser(user);
  if (maintenanceMode && !isAdmin) return <MaintenanceScreen />;

  return (
    <ChatClient
      currentUser={{
        ...user,
        isAdmin,
        maintenanceMode,
        createdAt: user.createdAt.toISOString()
      }}
    />
  );
}
