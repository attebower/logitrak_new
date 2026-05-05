import { redirect } from "next/navigation";

export default function LegacyLocationsRedirect() {
  redirect("/settings/locations");
}
