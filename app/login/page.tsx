import { redirect } from "next/navigation"

// The landing page (with its sign-in reveal) now lives at the bare domain.
// Keep /login working for old links by sending it there.
export default function LoginRedirect() {
  redirect("/")
}
