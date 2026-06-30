import { Landing } from "@/components/landing/Landing"

// The bare domain is the public landing page, shown to everyone (signed in or
// not). The app home moved to /home behind the auth gate.
export default function Page() {
  return <Landing />
}
