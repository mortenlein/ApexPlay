import { redirect } from "next/navigation";

export default async function TournamentManagePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  redirect(`/admin/tournaments/${params.id}`);
}
