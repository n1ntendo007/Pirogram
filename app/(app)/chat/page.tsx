import { redirect } from "next/navigation";
import ChatClient from "./chat-client";
import { getCurrentUser } from "@/lib/auth";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return <ChatClient currentUser={user} />;
}
