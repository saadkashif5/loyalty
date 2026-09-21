import { redirect } from "next/navigation";
import { getAccessToken } from "@/lib/session";

export default function HomePage() {
  redirect(getAccessToken() ? "/businesses" : "/login");
}
