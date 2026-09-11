'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { Trophy, Users, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, Loader2, Gamepad2, Upload, Share2, Copy, Hash, Crown, LogOut, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TopNav } from '@/components/ui';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';
import { useToast } from '@/components/ToastProvider';
import { RouteNotFoundState } from '@/components/RouteStates';
import { SeatEditor, SEAT_HELPER_TEXT, SEAT_MAX_LENGTH } from '@/components/player/SeatEditor';
import { clientApi } from '@/lib/client-api';

const PUBLIC_NAV = [{ href: '/tournaments', label: 'Tournaments' }];

export default function RegisterPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const inviteCode = searchParams.get('invite');
    const toast = useToast();

    const [tournament, setTournament] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Optional LAN seat the player types while signing up, sent along with the signup POST.
    const [seating, setSeating] = useState('');

    const [teamData, setTeamData] = useState({
        name: '',
        logoUrl: '',
        players: [] as any[]
    });
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [userTeam, setUserTeam] = useState<any>(null);
    const sessionSteamId = (session?.user as any)?.steamId as string | undefined;
    const isSignedIn = Boolean(session?.user);
    // Steam-signup tournaments additionally need a Steam-linked account (invite links key off it).
    const requiresSteamAuth = Boolean(tournament?.steamSignupEnabled) && (!isSignedIn || !sessionSteamId);
    // Every registration is now tied to a user account — anonymous sign-up is gone.
    const requiresSignIn = !isSignedIn || requiresSteamAuth;

    /**
     * Pulls the viewer's own team out of the teams endpoint. That endpoint marks the viewer's
     * own player rows with isMe (and only then exposes that team's invite code), so it is the
     * canonical shape for the team panel — richer than the signup POST response.
     */
    const loadMyTeam = useCallback(async () => {
        try {
            const teams = await clientApi.getTeams(params.id);
            const myTeam = Array.isArray(teams)
                ? teams.find((t: any) => t.players?.some((p: any) => p.isMe))
                : undefined;
            if (myTeam) setUserTeam(myTeam);
            return myTeam ?? null;
        } catch {
            return null;
        }
    }, [params.id]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`/api/tournaments/${params.id}`);
                const current = await res.json();
                if (res.ok) {
                    setTournament(current);
                    setTeamData(prev => ({
                        ...prev,
                        players: Array(current.teamSize || 5).fill({ name: '', nickname: '', countryCode: 'no', steamId: '' })
                    }));
                } else {
                    setError('Tournament not found');
                }

                if (session && sessionSteamId && current.steamSignupEnabled) {
                    await loadMyTeam();
                }
            } catch (err) {
                setError('Failed to load tournament details');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [params.id, session, sessionSteamId, loadMyTeam]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            let logoUrl = teamData.logoUrl;
            if (logoFile) {
                const uploadData = new FormData();
                uploadData.append('file', logoFile);
                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadData
                });
                if (!uploadRes.ok) throw new Error('Logo upload failed');
                const { url } = await uploadRes.json();
                logoUrl = url;
            }

            if (tournament?.steamSignupEnabled) {
                const res = await fetch(`/api/tournaments/${params.id}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'CREATE_TEAM',
                        teamName: teamData.name,
                        logoUrl: logoUrl,
                        seating,
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Registration failed');
                }
                const newTeam = await res.json();
                setUserTeam(newTeam);
                // Re-read the roster so the panel gets the isMe/inviteCode shape it renders from.
                await loadMyTeam();
                setSuccess(true);
            } else {
                const cleanedPlayers = teamData.players.filter(p => p.name.trim() !== '');
                if (cleanedPlayers.length < (tournament?.teamSize || 1)) {
                    throw new Error(`Minimum ${tournament?.teamSize || 1} players required`);
                }

                const res = await fetch(`/api/tournaments/${params.id}/teams`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: teamData.name,
                        logoUrl: logoUrl,
                        players: cleanedPlayers
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Registration failed');
                }
                setSuccess(true);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleJoinTeam = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`/api/tournaments/${params.id}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'JOIN_TEAM',
                    inviteCode: inviteCode,
                    seating,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Joining team failed');
            }
            const joinedTeam = await res.json();
            setUserTeam(joinedTeam);
            // Re-read the roster so the panel gets the isMe/inviteCode shape it renders from.
            await loadMyTeam();
            setSuccess(true);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const updatePlayer = (index: number, field: string, value: string) => {
        const newPlayers = [...teamData.players];
        newPlayers[index] = { ...newPlayers[index], [field]: value };
        setTeamData({ ...teamData, players: newPlayers });
    };

    /** Keeps the rendered roster in sync after the inline seat editor saves. */
    const handleSeatSaved = (nextSeating: string | null) => {
        setUserTeam((current: any) => current && ({
            ...current,
            players: (current.players || []).map((player: any) =>
                player.isMe ? { ...player, seating: nextSeating } : player
            ),
        }));
    };

    const handleLeaveTeam = async () => {
        if (!window.confirm('Leave this team? Your registration for this tournament is removed.')) return;
        setLeaving(true);
        try {
            const result = await clientApi.leaveMyTeam(params.id);
            setUserTeam(null);
            setSuccess(false);
            setSeating('');
            toast.success(
                'You left the team',
                result.teamDeleted ? 'The team had no players left, so it was removed.' : undefined
            );
            router.refresh();
        } catch (err: any) {
            toast.error('Could not leave the team', err?.message || 'Please try again.');
        } finally {
            setLeaving(false);
        }
    };

    const copyText = (text: string) => {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            return;
        }
        // Fallback for non-HTTPS/LAN environments
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    };

    if (loading || status === 'loading') return (
        <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center gap-6">
            <Loader2 className="w-12 h-12 text-[var(--mds-action)] animate-spin" />
            <span className="mds-uppercase-label opacity-40">Loading tournament portal...</span>
        </div>
    );

    if (!tournament) {
        return (
            <RouteNotFoundState
                title="Tournament Not Found"
                description="This registration link is invalid or the tournament no longer exists."
                primaryLabel="Back to Tournaments"
                primaryHref="/tournaments"
            />
        );
    }

    // A player who is already on a team keeps access to their team panel forever — including
    // after the bracket is generated. Seats change on the LAN floor, and the invite link stays
    // useful right up to lock, so this branch deliberately runs BEFORE the locked notice.
    if (userTeam || success) {
        const players: any[] = userTeam?.players || [];
        const myPlayer = players.find((player) => player.isMe);
        const isFull = players.length >= (tournament?.teamSize || 1);
        const registrationLink = typeof window !== 'undefined' && userTeam?.inviteCode
            ? `${window.location.origin}/tournaments/${params.id}/register?invite=${userTeam.inviteCode}`
            : '';

        return (
            <div className="min-h-screen bg-[var(--mds-page)] text-[var(--mds-text-primary)]">
                <div className="mx-auto max-w-2xl px-6 py-16 lg:py-24">
                    <div className="mds-card p-8 lg:p-10 space-y-10 shadow-2xl">
                        <header className="text-center space-y-4">
                            <div className="w-16 h-16 bg-[var(--mds-action-soft)] rounded-2xl flex items-center justify-center border border-[var(--mds-action)]/20 mx-auto">
                                <CheckCircle2 className="w-8 h-8 text-[var(--mds-action)]" />
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tight">
                                {success ? 'Registration Confirmed' : 'Your Team'}
                            </h1>
                            <p className="mds-uppercase-label text-[10px] opacity-50 leading-relaxed">
                                Team <span className="text-[var(--mds-action)]">&quot;{userTeam?.name || teamData.name}&quot;</span> is registered for <span className="text-[var(--mds-text-primary)]">{tournament?.name}</span>.
                            </p>
                            {tournament.rosterLocked && (
                                <p className="inline-flex items-center gap-2 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-input)]/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--mds-text-muted)]">
                                    <Lock size={12} /> Bracket is live — roster locked
                                </p>
                            )}
                        </header>

                        {/* Your seat — editable at any time, locked bracket included. */}
                        {myPlayer && (
                            <section className="rounded-2xl border border-[var(--mds-border)] bg-[var(--mds-input)]/40 p-6 space-y-3">
                                <h3 className="mds-uppercase-label text-[11px] text-[var(--mds-action)] flex items-center gap-3">
                                    <Hash size={14} /> Your Seat
                                </h3>
                                <SeatEditor
                                    tournamentId={params.id}
                                    seating={myPlayer.seating}
                                    onSaved={handleSeatSaved}
                                />
                            </section>
                        )}

                        {/* Roster + seats, so the whole team can see who is sitting where. */}
                        {players.length > 0 && (
                            <section className="space-y-4">
                                <h3 className="mds-uppercase-label text-[11px] opacity-50 flex items-center gap-3">
                                    <Users size={14} /> Roster ({players.length}/{tournament?.teamSize})
                                </h3>
                                <ul className="space-y-2">
                                    {players.map((player) => (
                                        <li
                                            key={player.id}
                                            className="flex items-center justify-between gap-4 rounded-lg border border-[var(--mds-border)] bg-[var(--mds-page)] px-5 py-3"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="truncate text-sm font-bold">
                                                    {player.nickname || player.name}
                                                </span>
                                                {player.isLeader && (
                                                    <span title="Team leader"><Crown size={13} className="text-[var(--mds-action)]" /></span>
                                                )}
                                                {player.isMe && (
                                                    <span className="mds-badge bg-[var(--mds-action)]/10 text-[var(--mds-action)] text-[8px] font-black uppercase tracking-widest border-[var(--mds-action)]/20">You</span>
                                                )}
                                            </div>
                                            <span className="shrink-0 font-mono text-[11px] text-[var(--mds-text-muted)]">
                                                {player.seating || 'No seat'}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {!isFull && tournament.steamSignupEnabled && registrationLink && !tournament.rosterLocked && (
                            <section className="bg-[var(--mds-input)] border border-[var(--mds-border)] rounded-2xl p-6 space-y-5">
                                <h3 className="mds-uppercase-label text-[11px] text-[var(--mds-action)] flex items-center gap-3">
                                    <Share2 size={14} /> Invite Teammates
                                </h3>
                                <div className="bg-[var(--mds-page)] border border-[var(--mds-border)] rounded-lg px-5 py-3 font-mono text-[11px] break-all text-[var(--mds-text-muted)] text-left">
                                    {registrationLink}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        copyText(registrationLink);
                                        toast.success('Invite link copied', 'Share it with the rest of your team.');
                                    }}
                                    className="mds-btn-primary w-full h-12 text-[11px] font-black uppercase tracking-widest gap-3"
                                >
                                    <Copy size={14} /> Copy Invite Link
                                </button>
                                <p className="text-[9px] font-bold text-[var(--mds-text-subtle)] uppercase tracking-widest">
                                    {(tournament.teamSize || 0) - players.length} slots remaining in the roster.
                                </p>
                            </section>
                        )}

                        <div className="flex flex-col gap-4">
                            <Link
                                href={`/tournaments/${params.id}`}
                                className="mds-btn-primary h-14 w-full text-[12px] font-black uppercase tracking-widest gap-3"
                            >
                                Open Tournament Overview <ArrowRight size={18} />
                            </Link>
                            {/* Leaving is self-service only until the bracket exists; after that the
                                API answers 423 and an organizer has to move the player. */}
                            {!tournament.rosterLocked && myPlayer && (
                                <button
                                    type="button"
                                    onClick={handleLeaveTeam}
                                    disabled={leaving}
                                    className="mds-btn-secondary h-12 w-full text-[11px] font-black uppercase tracking-widest gap-3 disabled:opacity-50"
                                >
                                    {leaving ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                                    Leave Team
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Only visitors who are NOT on a team hit the closed notice.
    if (tournament.rosterLocked) {
        return (
            <div className="min-h-screen bg-[var(--mds-page)] text-[var(--mds-text-primary)]">
                <div className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6">
                    <div className="w-full rounded-xl border border-[var(--mds-border)] bg-[var(--mds-card)] p-8 text-center">
                        <h1 className="text-2xl font-black uppercase tracking-tight">Registration Closed</h1>
                        <p className="mt-3 text-sm text-[var(--mds-text-muted)]">
                            Team registration is locked for {tournament.name}. Contact an admin if this is unexpected.
                        </p>
                        <Link href={`/tournaments/${params.id}`} className="mds-btn-primary mt-6 h-11 px-8 text-xs font-black uppercase tracking-widest">
                            Return to Tournament
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--mds-page)] text-[var(--mds-text-primary)] selection:bg-[var(--mds-action-soft)] selection:text-white">

            <div className="max-w-4xl mx-auto px-6 py-16 lg:py-24">
                <header className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <Trophy size={20} className="text-[var(--mds-action)]" />
                        <span className="mds-uppercase-label text-[11px] tracking-[0.2em]">Official Registration</span>
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black uppercase tracking-tight leading-none mb-6">
                        {tournament?.name || 'Loading...'}
                    </h1>
                    <div className="flex items-center gap-6 mds-uppercase-label text-[10px] opacity-40">
                        <span>Format: {tournament?.format}</span>
                        <span>•</span>
                        <span>Team Size: {tournament?.teamSize} Players</span>
                    </div>
                </header>

                <main>
                    {requiresSignIn ? (
                        <div className="mds-card p-12 text-center shadow-xl space-y-10">
                            <div className="w-16 h-16 bg-[var(--mds-action-soft)] rounded-2xl flex items-center justify-center mx-auto border border-[var(--mds-action)]/20 shadow-lg">
                                <Gamepad2 size={32} className="text-[var(--mds-action)]" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-black uppercase tracking-tight">
                                    {tournament?.steamSignupEnabled ? 'Steam Verification Required' : 'Sign In Required'}
                                </h2>
                                <p className="text-[var(--mds-text-muted)] text-[13px] font-medium max-w-md mx-auto leading-relaxed">
                                    {tournament?.steamSignupEnabled
                                        ? 'This tournament requires a Steam-linked login to verify player identities and enable invite links.'
                                        : 'Registration is tied to your account, so sign in before entering a team.'}
                                </p>
                            </div>
                            <button 
                                onClick={() => signIn('steam', { callbackUrl: `/tournaments/${params.id}/register${inviteCode ? `?invite=${inviteCode}` : ''}` })}
                                className="mds-btn-primary h-14 px-10 text-[12px] font-black uppercase tracking-widest gap-4 group"
                            >
                                <Gamepad2 size={20} className="group-hover:rotate-12 transition-transform" />
                                Continue with Steam
                            </button>
                            {session && !sessionSteamId && (
                                <button
                                    type="button"
                                    onClick={() => signOut({ callbackUrl: `/tournaments/${params.id}/register${inviteCode ? `?invite=${inviteCode}` : ''}` })}
                                    className="mds-btn-secondary h-12 px-8 text-[11px] font-black uppercase tracking-widest gap-3"
                                >
                                    Switch Account
                                </button>
                            )}
                            <MockPersonaButtons callbackUrl={`/tournaments/${params.id}/register${inviteCode ? `?invite=${inviteCode}` : ''}`} />
                        </div>
                    ) : inviteCode && tournament?.steamSignupEnabled ? (
                        <div className="mds-card p-12 text-center shadow-xl space-y-10">
                            <div className="w-16 h-16 bg-[var(--mds-action-soft)] rounded-2xl flex items-center justify-center mx-auto border border-[var(--mds-action)]/20">
                                <Users size={32} className="text-[var(--mds-action)]" />
                            </div>
                            <div className="space-y-4">
                                <h2 className="text-2xl font-black uppercase tracking-tight">Join Existing Team</h2>
                                <p className="text-[var(--mds-text-muted)] text-[13px] font-medium max-w-md mx-auto leading-relaxed">
                                    You have been invited to join a team with code: <span className="text-[var(--mds-action)] font-mono">{inviteCode}</span>
                                </p>
                            </div>

                            {/* Optional, but strongly prompted: the seat is how marshals find you. */}
                            <div className="mx-auto max-w-xs space-y-3 text-left">
                                <label htmlFor="join-seating" className="mds-uppercase-label text-[10px] opacity-50">
                                    Your Seat (Optional)
                                </label>
                                <input
                                    id="join-seating"
                                    type="text"
                                    value={seating}
                                    maxLength={SEAT_MAX_LENGTH}
                                    onChange={(e) => setSeating(e.target.value)}
                                    className="mds-input h-12 px-5 text-sm font-bold uppercase tracking-wide"
                                    placeholder="e.g. B12"
                                />
                                <p className="text-[11px] text-[var(--mds-text-subtle)]">{SEAT_HELPER_TEXT}</p>
                            </div>

                            <button
                                onClick={handleJoinTeam}
                                disabled={submitting}
                                className="mds-btn-primary h-14 px-10 text-[12px] font-black uppercase tracking-widest gap-3 disabled:opacity-50"
                            >
                                {submitting ? <Loader2 size={20} className="animate-spin" /> : <ShieldCheck size={20} />}
                                Join Roster
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-8">
                            <section className="mds-card p-10 lg:p-12 space-y-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-lg bg-[var(--mds-action)]/10 text-[var(--mds-action)] flex items-center justify-center font-black text-xs border border-[var(--mds-action)]/20">01</div>
                                    <h2 className="text-xl font-black uppercase tracking-tight">Team Identity</h2>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                    <div className="space-y-4">
                                        <label className="mds-uppercase-label text-[10px] opacity-50">Team Name</label>
                                        <input 
                                            type="text"
                                            required
                                            value={teamData.name}
                                            onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
                                            className="mds-input h-14 px-6 font-bold uppercase tracking-wide text-sm"
                                            placeholder="Enter unique team name"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <label className="mds-uppercase-label text-[10px] opacity-50">Team Logo (Optional)</label>
                                        <div className="relative h-14">
                                            <input 
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        setLogoFile(file);
                                                        setLogoPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="mds-input h-full flex items-center justify-between px-6 bg-[var(--mds-input)]">
                                                <span className="text-[11px] font-bold text-[var(--mds-text-subtle)] uppercase">
                                                    {logoFile ? logoFile.name : 'Upload PNG/JPG'}
                                                </span>
                                                <Upload size={16} className="text-[var(--mds-text-subtle)]" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Seat for the registering player. Optional, but the LAN runs on it:
                                    the signup route stores it on this player's own row. */}
                                {tournament?.steamSignupEnabled && (
                                    <div className="max-w-xs space-y-3">
                                        <label htmlFor="create-seating" className="mds-uppercase-label text-[10px] opacity-50">
                                            Your Seat (Optional)
                                        </label>
                                        <input
                                            id="create-seating"
                                            type="text"
                                            value={seating}
                                            maxLength={SEAT_MAX_LENGTH}
                                            onChange={(e) => setSeating(e.target.value)}
                                            className="mds-input h-14 px-6 text-sm font-bold uppercase tracking-wide"
                                            placeholder="e.g. B12"
                                        />
                                        <p className="text-[11px] text-[var(--mds-text-subtle)]">{SEAT_HELPER_TEXT}</p>
                                    </div>
                                )}

                                {(teamData.name || logoPreview) && (
                                    <div className="p-8 bg-[var(--mds-input)] rounded-xl border border-[var(--mds-border)] flex items-center gap-8">
                                        <div className="h-20 w-20 bg-[var(--mds-page)] rounded-lg border border-[var(--mds-border)] flex items-center justify-center p-3 relative overflow-hidden shadow-inner">
                                            {logoPreview ? (
                                                <Image src={logoPreview} alt="" fill className="object-contain p-2" />
                                            ) : (
                                                <Users size={24} className="text-[var(--mds-text-subtle)] opacity-50" />
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black uppercase tracking-tight text-[var(--mds-text-primary)]">
                                                {teamData.name || 'Your Team Name'}
                                            </h4>
                                            <p className="mds-uppercase-label text-[9px] mt-1 opacity-40 uppercase tracking-widest">Team Profile Preview</p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {!tournament?.steamSignupEnabled && (
                                <section className="mds-card p-10 lg:p-12 space-y-12">
                                    <div className="flex items-center gap-4">
                                        <div className="h-8 w-8 rounded-lg bg-[var(--mds-action)]/10 text-[var(--mds-action)] flex items-center justify-center font-black text-xs border border-[var(--mds-action)]/20">02</div>
                                        <h2 className="text-xl font-black uppercase tracking-tight">Player Roster</h2>
                                    </div>

                                    <div className="space-y-6">
                                        {teamData.players.map((player, i) => (
                                            <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-[var(--mds-input)]/40 rounded-xl border border-[var(--mds-border)]/50 group hover:border-[var(--mds-action)]/30 transition-all">
                                                <div className="space-y-3">
                                                    <label className="mds-uppercase-label text-[9px] opacity-40">Player Name (P{i+1})</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        value={player.name}
                                                        onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                                                        className="mds-input h-11 px-4 text-sm font-bold uppercase tracking-tight"
                                                        placeholder="Nickname or Full Name"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="mds-uppercase-label text-[9px] opacity-40">Steam Profile / ID</label>
                                                    <input 
                                                        type="text"
                                                        required
                                                        value={player.steamId}
                                                        onChange={(e) => updatePlayer(i, 'steamId', e.target.value)}
                                                        className="mds-input h-11 px-4 text-sm font-bold opacity-80"
                                                        placeholder="Steam Profile Link or ID64"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {error && (
                                <div className="bg-[var(--mds-red)]/10 border border-[var(--mds-red)]/20 p-6 rounded-xl flex items-center gap-4 text-[var(--mds-red)]">
                                    <AlertCircle size={20} />
                                    <span className="text-[11px] font-black uppercase tracking-widest">{error}</span>
                                </div>
                            )}

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="mds-btn-primary h-16 w-full text-[13px] font-black uppercase tracking-widest gap-4 shadow-2xl disabled:opacity-50"
                            >
                                {submitting ? (
                                    <><Loader2 size={24} className="animate-spin" /> Submitting Registration...</>
                                ) : (
                                    <><CheckCircle2 size={24} /> Complete Registration</>
                                )}
                            </button>
                        </form>
                    )}
                </main>
            </div>
        </div>
    );
}
