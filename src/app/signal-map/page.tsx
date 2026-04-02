import { redirect } from "next/navigation";

// Route cũ được chuyển hướng sang khu dashboard.
export default function SignalMapRedirectPage() {
  redirect("/dashboard/signal-map");
}
