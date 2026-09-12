'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Loader2, Menu } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getGameMetadata } from '@/lib/games';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';

import { ManageSidebar } from './tournament/manage/ManageSidebar';
import { StageStepper } from './tournament/manage/StageStepper';
import { ManageControl, stageLabel, totalRoundsOf } from './tournament/manage/ManageControl';
import { ManageOverview } from './tournament/manage/ManageOverview';
import { ManageParticipants } from './tournament/manage/ManageParticipants';
import { ManageMatches } from './tournament/manage/ManageMatches';
import { ManageSettings } from './tournament/manage/ManageSettings';
import { EditTeamModal } from './tournament/manage/EditTeamModal';
import { EditMatchModal } from './tournament/manage/EditMatchModal';
import { useManageWorkspace } from './tournament/manage/useManageWorkspace';

interface TournamentManageClientProps {
    tournamentId: string;
}

/**
 * The organizer workspace: a sidebar, one tab on screen, and the two editors. Everything that
 * talks to the server lives in `useManageWorkspace`; this file only decides what is visible.
 */
export default function TournamentManageClient({ tournamentId }: TournamentManageClientProps) {
    usePerformanceBudget('TournamentManageClient', 250);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('control');

    const workspace = useManageWorkspace(tournamentId);
    const { tournament, teams, matches, editingTeam, editingMatch } = workspace;

    const updateActiveTab = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    if (workspace.loading && !tournament) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--mds-page)]">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--mds-action)]" />
                <span className="mds-uppercase-label opacity-60">Loading tournament workspace…</span>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="min-h-screen bg-[var(--mds-page)] p-8 text-[var(--mds-text-primary)]">
                <div className="mx-auto mt-20 max-w-xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
                    <h1 className="text-2xl font-bold tracking-tight">Tournament not found</h1>
                    <p className="mt-3 text-sm text-[var(--mds-text-muted)]">
                        This workspace can no longer find the requested tournament.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push('/admin')}
                        className="mds-btn-primary mt-6 h-11 px-8 text-sm font-bold"
                    >
                        Back to admin
                    </button>
                </div>
            </div>
        );
    }

    const gameMeta = getGameMetadata(tournament.game);

    return (
        <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[var(--mds-page)] text-[var(--mds-text-primary)] antialiased">
            <div className="flex flex-1 overflow-hidden">
                <ManageSidebar
                    tournamentId={tournamentId}
                    activeTab={activeTab}
                    onTabChange={updateActiveTab}
                    isMenuOpen={isMenuOpen}
                    setIsMenuOpen={setIsMenuOpen}
                    category={tournament.category}
                />

                <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
                    {/* WORKSPACE HEADER — the label shouts, the tournament's own name never does. */}
                    <header className="relative shrink-0 overflow-hidden border-b border-[var(--mds-border)] bg-[var(--mds-card)]">
                        <div className="absolute inset-0 z-0">
                            {gameMeta?.bannerUrl && (
                                <Image
                                    src={gameMeta.bannerUrl}
                                    alt=""
                                    fill
                                    sizes="100vw"
                                    className="object-cover opacity-[0.07] grayscale brightness-50"
                                    priority={false}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--mds-page)] via-transparent to-transparent" />
                        </div>

                        <div className="relative z-10 flex items-center gap-4 px-6 py-5 lg:px-10">
                            <button
                                onClick={() => setIsMenuOpen(true)}
                                aria-label="Open workspace menu"
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)] text-[var(--mds-text-primary)] transition-all hover:border-[var(--mds-action)]/40 md:hidden"
                            >
                                <Menu size={20} />
                            </button>

                            <div className="min-w-0 flex-1">
                                <p className="mds-uppercase-label text-[var(--mds-action)]">
                                    Organizer workspace · {gameMeta?.name || tournament.game}
                                </p>
                                <h1 className="mds-name-lg mt-1 text-2xl leading-tight md:text-3xl">
                                    {tournament.name}
                                </h1>
                            </div>
                        </div>
                    </header>

                    <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-6 lg:px-10 lg:py-8">
                        <div className="mx-auto max-w-[1400px] space-y-6">
                            <StageStepper
                                teams={teams}
                                matches={matches}
                                onAction={(stage) => {
                                    if (stage === 'DRAFT') {
                                        updateActiveTab('participants');
                                    } else if (stage === 'REGISTRATION') {
                                        workspace.handleGenerateMatches();
                                    } else if (stage === 'LIVE') {
                                        updateActiveTab('control');
                                    } else {
                                        window.open(`/tournaments/${tournamentId}`, '_blank');
                                    }
                                }}
                            />

                            {activeTab === 'control' && (
                                <ManageControl
                                    tournament={tournament}
                                    teams={teams}
                                    matches={matches}
                                    onOpenMatchModal={workspace.openMatchModal}
                                />
                            )}

                            {activeTab === 'overview' && (
                                <ManageOverview
                                    tournament={tournament}
                                    teams={teams}
                                    matches={matches}
                                    activity={workspace.activity}
                                    notifications={workspace.notifications}
                                    onGenerateMatches={() => workspace.handleGenerateMatches(true)}
                                    generating={workspace.generating}
                                    onCopyPublicLink={workspace.handleCopyPublicLink}
                                    onOpenMatchModal={workspace.openMatchModal}
                                    onSetTab={updateActiveTab}
                                />
                            )}

                            {activeTab === 'participants' && (
                                <ManageParticipants
                                    tournament={tournament}
                                    teams={teams}
                                    newTeam={workspace.newTeam}
                                    setNewTeam={workspace.setNewTeam}
                                    onAddTeam={workspace.onAddTeam}
                                    onEditTeam={workspace.openTeamEditor}
                                    onDeleteTeam={workspace.handleDeleteTeam}
                                    onDragStart={workspace.onDragStart}
                                    onDragOver={workspace.onDragOver}
                                    onDragEnd={workspace.onDragEnd}
                                    draggedItemIndex={workspace.draggedItemIndex}
                                    draftSeeds={workspace.draftSeeds}
                                    setDraftSeeds={workspace.setDraftSeeds}
                                    onSaveSeeds={workspace.handleSaveSeeds}
                                    importCsv={workspace.importCsv}
                                    setImportCsv={workspace.setImportCsv}
                                    onImportCsv={workspace.handleImportCsv}
                                    onExportCsv={workspace.handleExportCsv}
                                    importing={workspace.importing}
                                />
                            )}

                            {(activeTab === 'matches' || activeTab === 'scoreboard') && (
                                <ManageMatches
                                    matches={matches}
                                    onGenerateMatches={() => workspace.handleGenerateMatches(true)}
                                    generating={workspace.generating}
                                    onOpenMatchModal={workspace.openMatchModal}
                                    teamsCount={teams.length}
                                />
                            )}

                            {activeTab === 'settings' && (
                                <ManageSettings
                                    tournament={tournament}
                                    onUpdateTournament={workspace.updateTournament}
                                    onDeleteTournament={workspace.deleteTournament}
                                    updating={workspace.updating}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {editingTeam && (
                <EditTeamModal
                    team={editingTeam}
                    tournament={tournament}
                    onClose={workspace.closeTeamEditor}
                    onSaveTeam={(payload) => workspace.handleSaveTeamFields(editingTeam.id, payload)}
                    onAddPlayer={(payload) => workspace.handleAddPlayer(editingTeam.id, payload)}
                    onSavePlayer={workspace.handleSavePlayer}
                    onDeletePlayer={workspace.handleDeletePlayer}
                />
            )}

            {editingMatch && (
                <EditMatchModal
                    match={editingMatch}
                    onClose={workspace.closeMatchModal}
                    matchForm={workspace.matchForm}
                    setMatchForm={workspace.setMatchForm}
                    onSaveMatch={(event) => {
                        event.preventDefault();
                        workspace.saveMatch();
                    }}
                    onForfeit={workspace.forfeitMatch}
                    onAnnounceDiscord={workspace.handleAnnounceDiscord}
                    onLoadMatch={workspace.loadMatch}
                    isSaving={workspace.isSavingMatch}
                    isLoadingMatch={workspace.isLoadingMatch}
                    stageName={stageLabel(editingMatch, totalRoundsOf(matches))}
                />
            )}
        </div>
    );
}
