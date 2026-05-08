import { redirect } from "next/navigation";
import AuthClient from "./auth-client";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  if (currentUser) redirect("/chat");
  return <AuthClient />;
}
