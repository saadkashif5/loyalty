import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";

export default async function HomePage() {
  redirect((await getAccessToken()) ? "/businesses" : "/login");
}
