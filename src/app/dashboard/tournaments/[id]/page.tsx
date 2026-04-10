import { redirect } from "next/navigation";

export default async function TournamentManagePage({ params }: { params: { id: string } }) {
  redirect(`/admin/tournaments/${params.id}`);
}
