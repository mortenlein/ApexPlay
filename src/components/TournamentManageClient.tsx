'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Menu } from 'lucide-react';
import { getGameMetadata } from '@/lib/games';
import { useMatchStream } from '@/hooks/useMatchStream';
import { ContextBar } from '@/components/ContextBar';
import { ApiError, apiRequest, clientApi } from '@/lib/client-api';
import { useToast } from '@/components/ToastProvider';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Modular Components
import { ManageSidebar } from './tournament/manage/ManageSidebar';
import { ManageOverview } from './tournament/manage/ManageOverview';
import { ManageParticipants } from './tournament/manage/ManageParticipants';
import { ManageMatches } from './tournament/manage/ManageMatches';
import { ManageSettings } from './tournament/manage/ManageSettings';
import { EditTeamModal } from './tournament/manage/EditTeamModal';
import { EditMatchModal } from './tournament/manage/EditMatchModal';
import { usePerformanceBudget } from '@/hooks/usePerformanceBudget';

interface TournamentManageClientProps {
    tournamentId: string;
}

export default function TournamentManageClient({ tournamentId }: TournamentManageClientProps) {
    usePerformanceBudget('TournamentManageClient', 250);
    const queryClient = useQueryClient();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const toast = useToast();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [newTeam, setNewTeam] = useState({ name: '', logoUrl: '', seed: '', players: [] });
    const [generating, setGenerating] = useState(false);
    const [editingTeam, setEditingTeam] = useState<any>(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [draftSeeds, setDraftSeeds] = useState<Record<string, number | string>>({});
    const [importCsv, setImportCsv] = useState('');

    // Modal state
    const [editingMatch, setEditingMatch] = useState<any>(null);
    const [matchForm, setMatchForm] = useState({ homeScore: 0, awayScore: 0, bestOf: 1, status: 'READY', mapScores: [] });

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

    // Queries
    const { data: tournament, isLoading: tournamentLoading } = useQuery({
        queryKey: ['tournament', tournamentId],
        queryFn: async () => clientApi.getTournament(tournamentId),
    });

    const { data: teams = [], isLoading: teamsLoading } = useQuery({
        queryKey: ['teams', tournamentId],
        queryFn: async () => clientApi.getTeams(tournamentId),
    });

    const { data: matches = [], isLoading: matchesLoading } = useQuery({
        queryKey: ['matches', tournamentId],
        queryFn: async () => clientApi.getMatches(tournamentId),
    });

    const { data: activityData } = useQuery({
        queryKey: ['activity', tournamentId],
        queryFn: async () => clientApi.getAuditLog(tournamentId),
    });

    const { data: notificationData } = useQuery({
        queryKey: ['notifications', tournamentId],
        queryFn: async () => clientApi.getNotifications(tournamentId),
    });

    const loading = tournamentLoading || teamsLoading || matchesLoading;
    const activity = activityData?.entries || [];
    const notifications = notificationData?.notifications || [];

    const invalidateWorkspace = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
            queryClient.invalidateQueries({ queryKey: ['teams', tournamentId] }),
            queryClient.invalidateQueries({ queryKey: ['matches', tournamentId] }),
            queryClient.invalidateQueries({ queryKey: ['activity', tournamentId] }),
            queryClient.invalidateQueries({ queryKey: ['notifications', tournamentId] }),
            queryClient.invalidateQueries({ queryKey: ['tournaments'] }),
        ]);
    };

    const showMutationError = (error: unknown, fallback: string) => {
        if (error instanceof ApiError) {
            if (error.status === 409) {
                toast.error('Refresh needed', error.message);
                void invalidateWorkspace();
                return;
            }
            toast.error(fallback, error.message);
            return;
        }

        toast.error(fallback, error instanceof Error ? error.message : fallback);
    };

    // Live SSE match updates
    useMatchStream(tournamentId, (data) => {
        queryClient.setQueryData(['matches', tournamentId], (prev: any[] | undefined) =>
            prev?.map((m) => (m.id === data.matchId ? { ...m, ...data.match } : m))
        );
    });

    // Mutations
    const addTeamMutation = useMutation({
        mutationFn: async (payload: any) =>
            apiRequest(`/api/tournaments/${tournamentId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['teams', tournamentId] });
            const previousTeams = queryClient.getQueryData<any[]>(['teams', tournamentId]) || [];
            const optimisticTeam = {
                id: `optimistic-${Date.now()}`,
                name: payload.name,
                logoUrl: payload.logoUrl || '',
                seed: payload.seed || previousTeams.length + 1,
                players: payload.players || [],
            };
            queryClient.setQueryData(['teams', tournamentId], [...previousTeams, optimisticTeam]);
            return { previousTeams };
        },
        onSuccess: () => {
            setNewTeam({ name: '', logoUrl: '', seed: '', players: [] });
            toast.success('Team added', 'The team was added to the tournament roster.');
            void invalidateWorkspace();
        },
        onError: (error, _variables, context) => {
            if (context?.previousTeams) {
                queryClient.setQueryData(['teams', tournamentId], context.previousTeams);
            }
            showMutationError(error, 'Could not add team');
        },
    });

    const deleteTeamMutation = useMutation({
        mutationFn: async ({ teamId, teamSnapshot }: { teamId: string; teamSnapshot?: any }) => {
            const team = teams.find((entry: any) => entry.id === teamId);
            return apiRequest(`/api/teams/${teamId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expectedUpdatedAt: team?.updatedAt,
                }),
            });
        },
        onSuccess: (_, variables) => {
            const teamSnapshot = variables.teamSnapshot;
            toast.success(
                'Team removed',
                'The team was removed from the bracket roster.',
                teamSnapshot
                    ? {
                        label: 'Undo',
                        onAction: () => {
                            void apiRequest(`/api/tournaments/${tournamentId}/teams`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: teamSnapshot.name,
                                    logoUrl: teamSnapshot.logoUrl || '',
                                    seed: teamSnapshot.seed || '',
                                    players: (teamSnapshot.players || []).map((player: any) => ({
                                        name: player.name,
                                        nickname: player.nickname || '',
                                        countryCode: player.countryCode || '',
                                        seating: player.seating || '',
                                        steamId: player.steamId || '',
                                        isLeader: Boolean(player.isLeader),
                                    })),
                                }),
                            })
                                .then(() => {
                                    toast.success('Team restored', `${teamSnapshot.name} has been restored.`);
                                    void invalidateWorkspace();
                                })
                                .catch((error) => showMutationError(error, 'Could not restore team'));
                        },
                    }
                    : undefined
            );
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not remove team'),
    });

    const updateSeedsMutation = useMutation({
        mutationFn: async (newTeams: any[]) =>
            Promise.all(newTeams.map((team, index) =>
                apiRequest(`/api/teams/${team.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seed: index + 1, expectedUpdatedAt: team.updatedAt }),
                })
            )),
        onSuccess: () => {
            toast.success('Seeding updated', 'Bracket seed positions have been saved.');
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not save seeds'),
    });

    const generateMatchesMutation = useMutation({
        mutationFn: async () => {
            setGenerating(true);
            try {
                return await apiRequest(`/api/tournaments/${tournamentId}/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
            } finally {
                setGenerating(false);
            }
        },
        onSuccess: () => {
            toast.success(matches.length > 0 ? 'Bracket regenerated' : 'Bracket generated', 'Match structure is ready for staff and players.');
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not generate bracket'),
    });

    const saveMatchMutation = useMutation({
        mutationFn: async ({ id, ...payload }: any) =>
            apiRequest(`/api/matches/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    expectedUpdatedAt: editingMatch?.updatedAt,
                }),
            }),
        onSuccess: () => {
            setEditingMatch(null);
            toast.success('Match saved', 'Scores and match status were updated.');
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not save match'),
    });

    const loadMatchMutation = useMutation({
        mutationFn: async (matchId: string) =>
            apiRequest(`/api/matches/${matchId}/load`, {
                method: 'POST',
            }),
        onSuccess: () => {
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not start match'),
    });

    const updateTournamentMutation = useMutation({
        mutationFn: async (payload: any) =>
            apiRequest(`/api/tournaments/${tournamentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    expectedUpdatedAt: tournament?.updatedAt,
                }),
            }),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['tournament', tournamentId] });
            const previousTournament = queryClient.getQueryData(['tournament', tournamentId]);
            queryClient.setQueryData(['tournament', tournamentId], (current: any) => ({ ...current, ...payload }));
            return { previousTournament };
        },
        onSuccess: () => {
            toast.success('Settings updated', 'Tournament settings were saved.');
            void invalidateWorkspace();
        },
        onError: (error, _variables, context) => {
            if (context?.previousTournament) {
                queryClient.setQueryData(['tournament', tournamentId], context.previousTournament);
            }
            showMutationError(error, 'Could not update tournament');
        },
    });

    const importTeamsMutation = useMutation({
        mutationFn: async (csv: string) =>
            apiRequest(`/api/tournaments/${tournamentId}/teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'import',
                    csv,
                }),
            }),
        onSuccess: (result: any) => {
            setImportCsv('');
            toast.success('Teams imported', `${result.count || 0} teams were added from CSV.`);
            void invalidateWorkspace();
        },
        onError: (error) => showMutationError(error, 'Could not import teams'),
    });

    const handleSaveSeeds = async () => {
        const payload = teams.map((team: any, index: number) => ({
            ...team,
            seed: draftSeeds[team.id] !== undefined ? draftSeeds[team.id] : (team.seed || index + 1),
        }));
        await updateSeedsMutation.mutateAsync(payload);
        setDraftSeeds({});
    };

    const handleAnnounceDiscord = async (match: any, type: 'START' | 'RESULT', silent = false) => {
        try {
            await apiRequest(`/api/discord/announce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: match.id,
                    tournamentId,
                    type,
                }),
            });
            if (!silent) {
                toast.success('Announcement sent', 'The update was written to the notification stream.');
            }
            void invalidateWorkspace();
        } catch (error) {
            if (!silent) {
                showMutationError(error, 'Could not send match update');
            }
            throw error;
        }
    };

    const handleImportCsv = async () => {
        await importTeamsMutation.mutateAsync(importCsv);
    };

    const handleExportCsv = () => {
        window.open(`/api/tournaments/${tournamentId}/teams?format=csv`, '_blank', 'noopener,noreferrer');
        toast.info('Export started', 'A CSV download should open in a new tab.');
    };

    const handleCopyPublicLink = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/tournaments/${tournamentId}`);
        toast.success('Link copied', 'The public tournament link is on your clipboard.');
    };

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === index) return;

        const items = [...teams];
        const draggedItem = items[draggedItemIndex];
        items.splice(draggedItemIndex, 1);
        items.splice(index, 0, draggedItem);
        
        setDraggedItemIndex(index);
        queryClient.setQueryData(['teams', tournamentId], items);
    };

    const onDragEnd = () => {
        if (draggedItemIndex !== null) {
            updateSeedsMutation.mutate(teams);
        }
        setDraggedItemIndex(null);
    };

    if (loading && !tournament) return (
        <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[var(--mds-action)]" />
            <span className="mds-uppercase-label opacity-40">Loading tournament workspace...</span>
        </div>
    );

    if (!tournament) {
        return (
            <div className="min-h-screen bg-[var(--mds-page)] p-8 text-[var(--mds-text-primary)]">
                <div className="mx-auto mt-20 max-w-xl rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
                    <h1 className="text-2xl font-black uppercase tracking-tight">Tournament Not Found</h1>
                    <p className="mt-3 text-sm text-[var(--mds-text-muted)]">
                        This workspace can no longer find the requested tournament.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push("/admin")}
                        className="mds-btn-primary mt-6 h-11 px-8 text-xs font-black uppercase tracking-widest"
                    >
                        Back to Admin
                    </button>
                </div>
            </div>
        );
    }

    const gameMeta = getGameMetadata(tournament.game);

    return (
        <div className="flex flex-col h-screen bg-[var(--mds-page)] font-sans antialiased text-[var(--mds-text-primary)] overflow-hidden">
            <ContextBar
                mode="admin"
                contextLabel={tournament.name}
                phase={activeTab.toUpperCase()}
                breadcrumbs={['admin', 'tournaments', tournament.name, activeTab]}
            />
            
            <div className="flex flex-1 overflow-hidden">
                <ManageSidebar 
                    tournamentId={tournamentId} 
                    activeTab={activeTab} 
                    onTabChange={updateActiveTab} 
                    isMenuOpen={isMenuOpen} 
                    setIsMenuOpen={setIsMenuOpen} 
                    category={tournament.category}
                />

                <main className="flex-1 flex flex-col min-w-0 relative h-full overflow-hidden">
                    {/* ADMIN HEADER */}
                    <header className="h-40 shrink-0 relative overflow-hidden border-b border-[var(--mds-border)] bg-[var(--mds-card)]">
                        <div className="absolute inset-0 z-0">
                            {gameMeta?.bannerUrl && (
                                <Image
                                    src={gameMeta.bannerUrl} 
                                    alt=""
                                    fill
                                    sizes="100vw"
                                    className="object-cover opacity-10 grayscale brightness-50"
                                    priority={false}
                                />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--mds-page)] via-transparent to-transparent" />
                        </div>

                        <div className="relative z-10 h-full flex items-center px-10 gap-6">
                            <button 
                                onClick={() => setIsMenuOpen(true)}
                                className="md:hidden h-12 w-12 flex items-center justify-center rounded-xl bg-[var(--mds-input)] border border-[var(--mds-border)] text-[var(--mds-text-primary)] hover:border-[var(--mds-action)]/40 transition-all shadow-sm active:scale-95"
                            >
                                <Menu size={24} />
                            </button>
                            
                            <div className="flex flex-col justify-center gap-2">
                            <div className="flex items-center gap-3">
                                <span className="mds-badge bg-[var(--mds-action-soft)] text-[var(--mds-action)] border border-[var(--mds-action)]/20 font-black text-[9px] tracking-widest uppercase">
                                    Admin Workspace // {tournament.game}
                                </span>
                                <div className="h-1.5 w-1.5 rounded-full bg-[var(--mds-green)] shadow-[0_0_8px_var(--mds-green)]" />
                                <span className="mds-uppercase-label text-[8px] opacity-40 uppercase tracking-widest">Ready</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-[var(--mds-text-primary)] uppercase leading-none truncate">
                                {tournament.name}
                            </h1>
                        </div>
                    </div>
                    </header>

                    {/* VIEWPORT AREA */}
                    <div className="flex-1 overflow-y-auto p-10 lg:p-12 custom-scrollbar">
                        <div className="max-w-[1400px] mx-auto">
                            {activeTab === 'overview' && (
                                <ManageOverview 
                                    tournament={tournament}
                                    teams={teams}
                                    matches={matches}
                                    activity={activity}
                                    notifications={notifications}
                                    onGenerateMatches={() => generateMatchesMutation.mutate()}
                                    generating={generating}
                                    onCopyPublicLink={handleCopyPublicLink}
                                    onOpenMatchModal={(m) => {
                                        setEditingMatch(m);
                                        setMatchForm({ 
                                            homeScore: m.homeScore || 0, 
                                            awayScore: m.awayScore || 0, 
                                            bestOf: m.bestOf || 1,
                                            status: m.status || 'READY',
                                            mapScores: typeof m.mapScores === 'string' ? JSON.parse(m.mapScores) : (Array.isArray(m.mapScores) ? m.mapScores : [])
                                        });

                                    }}
                                    onSetTab={updateActiveTab}
                                />
                            )}

                            {activeTab === 'participants' && (
                                <ManageParticipants 
                                    tournament={tournament}
                                    teams={teams}
                                    newTeam={newTeam}
                                    setNewTeam={setNewTeam}
                                    onAddTeam={(e) => {
                                        e.preventDefault();
                                        addTeamMutation.mutate(newTeam);
                                    }}
                                    onEditTeam={setEditingTeam}
                                    onDeleteTeam={(id) => {
                                        const teamSnapshot = teams.find((team: any) => team.id === id);
                                        if (!teamSnapshot) return;
                                        const confirmed = window.confirm(
                                            `Remove ${teamSnapshot.name} from this tournament?\n\nImpact:\n- Team and roster are removed from bracket participation.\n- Match slots may become TBD.\n\nYou can undo immediately from the success toast.`
                                        );
                                        if (!confirmed) return;
                                        deleteTeamMutation.mutate({ teamId: id, teamSnapshot });
                                    }}
                                    onDragStart={onDragStart}
                                    onDragOver={onDragOver}
                                    onDragEnd={onDragEnd}
                                    draggedItemIndex={draggedItemIndex}
                                    draftSeeds={draftSeeds}
                                    setDraftSeeds={setDraftSeeds}
                                    onSaveSeeds={handleSaveSeeds}
                                    importCsv={importCsv}
                                    setImportCsv={setImportCsv}
                                    onImportCsv={handleImportCsv}
                                    onExportCsv={handleExportCsv}
                                    importing={importTeamsMutation.isPending}
                                />
                            )}

                            {(activeTab === 'matches' || activeTab === 'scoreboard') && (
                                <ManageMatches 
                                    matches={matches}
                                    onGenerateMatches={() => generateMatchesMutation.mutate()}
                                    generating={generating}
                                    onOpenMatchModal={(m) => {
                                        setEditingMatch(m);
                                        setMatchForm({ 
                                            homeScore: m.homeScore || 0, 
                                            awayScore: m.awayScore || 0, 
                                            bestOf: m.bestOf || 1,
                                            status: m.status || 'READY',
                                            mapScores: typeof m.mapScores === 'string' ? JSON.parse(m.mapScores) : (Array.isArray(m.mapScores) ? m.mapScores : [])
                                        });

                                    }}
                                    teamsCount={teams.length}
                                />
                            )}

                            {activeTab === 'settings' && (
                                <ManageSettings 
                                    tournament={tournament}
                                    onUpdateTournament={(payload) => updateTournamentMutation.mutate(payload)}
                                    onDeleteTournament={async () => {
                                        if (confirm(`Delete ${tournament.name} permanently?\n\nImpact:\n- Teams, players, matches, scoreboard, and logs are removed.\n- Overlay links stop working immediately.\n\nThis cannot be undone.`)) {
                                            try {
                                                await apiRequest(`/api/tournaments/${tournamentId}`, { method: 'DELETE' });
                                                toast.success('Tournament deleted', 'The tournament and related data were removed.', {
                                                    label: 'Open Admin',
                                                    onAction: () => router.push('/admin'),
                                                });
                                                router.push('/admin');
                                                router.refresh();
                                            } catch (error) {
                                                showMutationError(error, 'Could not delete tournament');
                                            }
                                        }
                                    }}
                                    updating={updateTournamentMutation.isPending}
                                />
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {/* MODALS */}
            {editingTeam && (
                <EditTeamModal 
                    team={editingTeam}
                    onClose={() => setEditingTeam(null)}
                    onDeletePlayer={(pid) => {
                        // Implement player deletion logic if needed
                        console.log("Delete player", pid);
                    }}
                />
            )}

            {editingMatch && (
                <EditMatchModal 
                    match={editingMatch}
                    onClose={() => setEditingMatch(null)}
                    matchForm={matchForm}
                    setMatchForm={setMatchForm}
                    onSaveMatch={(e) => {
                        e.preventDefault();
                        saveMatchMutation.mutate({ id: editingMatch.id, ...matchForm });
                    }}
                    onAnnounceDiscord={handleAnnounceDiscord}
                    onLoadMatch={async (matchId) => {
                        try {
                            const result: any = await loadMatchMutation.mutateAsync(matchId);
                            toast.success('Match ready', result.message || 'Match is ready for players.');
                        } catch (error: any) {
                            showMutationError(error, 'Could not start match');
                        }
                    }}
                    isSaving={saveMatchMutation.isPending}
                    isLoadingMatch={loadMatchMutation.isPending}
                />
            )}
        </div>
    );
}
