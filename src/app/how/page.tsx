import { redirect } from "next/navigation";

// How it works lives on the landing page now; old links land there.
export default function Page() {
  redirect("/#how");
}
