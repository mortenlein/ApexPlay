'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Copy,
    Crown,
    Gamepad2,
    Loader2,
    Lock,
    LogOut,
    ShieldCheck,
    Upload,
    Users,
} from 'lucide-react';
import { Badge, Button, Card, Input } from '@/components/ui';
import { MockPersonaButtons } from '@/components/MockPersonaButtons';
import { useToast } from '@/components/ToastProvider';
import { RouteNotFoundState } from '@/components/RouteStates';
import { SeatEditor, SEAT_HELPER_TEXT, SEAT_MAX_LENGTH } from '@/components/player/SeatEditor';
import { clientApi } from '@/lib/client-api';
import { FORMAT_OPTIONS } from '@/lib/games';

/** Never render the stored enum: SINGLE_ELIMINATION is a database value, not a sentence. */
const formatName = (format?: string | null) =>
    FORMAT_OPTIONS.find((option) => option.id === format)?.name ?? 'Bracket';

/** The shell every state of this page sits in: the tournament it is about, then one panel. */
function RegisterShell({
    tournament,
    children,
}: {
    tournament?: any;
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-page text-fg">
            <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-12">
                {tournament && (
                    <header className="space-y-2">
                        <p className="mds-uppercase-label text-fg-subtle">Register</p>
                        {/* The organiser's own casing — a tournament name is content, not a label. */}
                        <h1 className="mds-name-lg text-2xl sm:text-3xl">{tournament.name}</h1>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">{tournament.game}</Badge>
                            <Badge tone="neutral">{formatName(tournament.format)}</Badge>
                            <Badge tone="neutral">
                                <span className="mds-numeric">{tournament.teamSize}</span>
                                &nbsp;per team
                            </Badge>
                        </div>
                    </header>
                )}
                {children}
            </main>
        </div>
    );
}

function ErrorNotice({ message }: { message: string }) {
    return (
        <div
            role="alert"
            data-testid="register-error"
            className="flex items-start gap-3 rounded border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{message}</span>
        </div>
    );
}

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
    const [copied, setCopied] = useState<'link' | 'code' | null>(null);
    // Optional LAN seat the player types while signing up, sent along with the signup POST.
    const [seating, setSeating] = useState('');

    const [teamData, setTeamData] = useState({
        name: '',
        logoUrl: '',
        players: [] as any[],
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
    const callbackUrl = `/tournaments/${params.id}/register${inviteCode ? `?invite=${inviteCode}` : ''}`;

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
                    setTeamData((prev) => ({
                        ...prev,
                        players: Array(current.teamSize || 5).fill({ name: '', nickname: '', countryCode: 'no', steamId: '' }),
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
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadData });
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
                        logoUrl,
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
                const cleanedPlayers = teamData.players.filter((p) => p.name.trim() !== '');
                if (cleanedPlayers.length < (tournament?.teamSize || 1)) {
                    throw new Error(`Minimum ${tournament?.teamSize || 1} players required`);
                }

                const res = await fetch(`/api/tournaments/${params.id}/teams`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: teamData.name, logoUrl, players: cleanedPlayers }),
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
                body: JSON.stringify({ action: 'JOIN_TEAM', inviteCode, seating }),
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
        setUserTeam((current: any) =>
            current && {
                ...current,
                players: (current.players || []).map((player: any) =>
                    player.isMe ? { ...player, seating: nextSeating } : player
                ),
            }
        );
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

    const copyText = (text: string, what: 'link' | 'code') => {
        const done = () => {
            setCopied(what);
            window.setTimeout(() => setCopied(null), 2500);
        };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
            done();
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
            done();
        } catch (err) {
            console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
    };

    if (loading || status === 'loading') {
        return (
            <RegisterShell>
                <Card className="flex items-center gap-3" aria-busy="true">
                    <Loader2 className="animate-spin text-brand" size={18} />
                    <span className="text-sm text-fg-muted">Loading this tournament…</span>
                </Card>
            </RegisterShell>
        );
    }

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
        const teamSize = tournament?.teamSize || 1;
        const isFull = players.length >= teamSize;
        const slotsLeft = Math.max(0, teamSize - players.length);
        const registrationLink =
            typeof window !== 'undefined' && userTeam?.inviteCode
                ? `${window.location.origin}/tournaments/${params.id}/register?invite=${userTeam.inviteCode}`
                : '';
        const canInvite = !isFull && tournament.steamSignupEnabled && registrationLink && !tournament.rosterLocked;

        return (
            <RegisterShell tournament={tournament}>
                <Card className="space-y-6">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={22} />
                        <div className="space-y-1">
                            <h1 className="font-brand text-xl font-bold">
                                {success ? 'Registration Confirmed' : 'Your Team'}
                            </h1>
                            <p className="text-sm text-fg-muted">
                                You&apos;re registered with{' '}
                                <span className="mds-name text-fg">{userTeam?.name || teamData.name}</span>.
                            </p>
                        </div>
                    </div>

                    {tournament.rosterLocked && (
                        <p className="mds-inline-notice flex items-center gap-2 border-l-warning text-sm text-fg-muted">
                            <Lock size={14} className="shrink-0 text-warning" />
                            Bracket is live — roster locked
                        </p>
                    )}

                    {/* The seat is the one field a player owns, and the floor runs on it. */}
                    {myPlayer && (
                        <div className="rounded border border-line bg-field/40 px-4 py-3">
                            <p className="mds-uppercase-label text-fg-subtle">Your seat</p>
                            <SeatEditor
                                className="mt-1.5"
                                size="lg"
                                tournamentId={params.id}
                                seating={myPlayer.seating}
                                onSaved={handleSeatSaved}
                            />
                        </div>
                    )}

                    {/* Roster + seats, so the whole team can see who is sitting where. */}
                    {players.length > 0 && (
                        <div className="space-y-2">
                            <p className="mds-uppercase-label text-fg-subtle">
                                Roster ({players.length}/{teamSize})
                            </p>
                            <ul className="space-y-1.5">
                                {players.map((player) => (
                                    <li
                                        key={player.id}
                                        className="flex items-center justify-between gap-3 rounded border border-line bg-page px-4 py-2.5"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className="mds-name text-sm">{player.nickname || player.name}</span>
                                            {player.isLeader && (
                                                <span title="Team leader">
                                                    <Crown size={13} className="shrink-0 text-brand" />
                                                </span>
                                            )}
                                            {player.isMe && <Badge tone="info">You</Badge>}
                                        </span>
                                        <span
                                            className={`mds-numeric shrink-0 text-sm ${player.seating ? 'font-bold' : 'text-fg-subtle'}`}
                                        >
                                            {player.seating || 'No seat'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {canInvite && (
                        <div className="space-y-3 rounded border border-brand bg-brand-soft p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="mds-uppercase-label text-brand">Invite Teammates</p>
                                <p className="text-xs text-fg-muted">
                                    <span className="mds-numeric">{slotsLeft}</span>{' '}
                                    {slotsLeft === 1 ? 'slot' : 'slots'} left in the roster.
                                </p>
                            </div>

                            {/* The code is what gets read out across a table; the link is what gets
                                pasted into Discord. Both are one tap from here. */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div>
                                    <p className="mds-uppercase-label text-fg-subtle">Invite code</p>
                                    <p className="mds-numeric mt-0.5 text-2xl font-bold tracking-[0.12em]">
                                        {userTeam.inviteCode}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        copyText(userTeam.inviteCode, 'code');
                                        toast.success('Invite code copied');
                                    }}
                                >
                                    {copied === 'code' ? <Check size={14} /> : <Copy size={14} />}
                                    Copy code
                                </Button>
                            </div>

                            <p className="break-all rounded border border-line bg-page px-3 py-2 text-xs text-fg-muted">
                                {registrationLink}
                            </p>
                            <Button
                                type="button"
                                className="w-full"
                                onClick={() => {
                                    copyText(registrationLink, 'link');
                                    toast.success('Invite link copied', 'Share it with the rest of your team.');
                                }}
                            >
                                {copied === 'link' ? <Check size={15} /> : <Copy size={15} />}
                                Copy Invite Link
                            </Button>
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
                        <Link href={`/tournaments/${params.id}`}>
                            <Button variant="secondary">
                                Open Tournament Overview
                                <ArrowRight size={15} />
                            </Button>
                        </Link>
                        <Link href="/dashboard">
                            <Button variant="ghost">Go to my desk</Button>
                        </Link>
                        {/* Leaving is self-service only until the bracket exists; after that the
                            API answers 423 and an organizer has to move the player. */}
                        {!tournament.rosterLocked && myPlayer && (
                            <button
                                type="button"
                                onClick={handleLeaveTeam}
                                disabled={leaving}
                                className="ml-auto inline-flex h-8 items-center gap-2 px-2 text-xs font-semibold text-fg-subtle transition-colors hover:text-danger disabled:opacity-50"
                            >
                                {leaving ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                                Leave Team
                            </button>
                        )}
                    </div>
                </Card>
            </RegisterShell>
        );
    }

    // Only visitors who are NOT on a team hit the closed notice.
    if (tournament.rosterLocked) {
        return (
            <RegisterShell tournament={tournament}>
                <Card className="space-y-3">
                    <div className="flex items-center gap-2 text-warning">
                        <Lock size={16} />
                        <h1 className="font-brand text-xl font-bold text-fg">Registration Closed</h1>
                    </div>
                    <p className="text-sm text-fg-muted">
                        The bracket for <span className="mds-name text-fg">{tournament.name}</span> is drawn, so
                        teams can no longer sign up. Talk to an organizer if this is unexpected.
                    </p>
                    <div>
                        <Link href={`/tournaments/${params.id}`}>
                            <Button variant="secondary">
                                Return to Tournament
                                <ArrowRight size={15} />
                            </Button>
                        </Link>
                    </div>
                </Card>
            </RegisterShell>
        );
    }

    if (requiresSignIn) {
        return (
            <RegisterShell tournament={tournament}>
                <Card className="space-y-5">
                    <div className="flex items-start gap-3">
                        <Gamepad2 className="mt-0.5 shrink-0 text-brand" size={22} />
                        <div className="space-y-1">
                            <h1 className="font-brand text-xl font-bold">
                                {tournament?.steamSignupEnabled ? 'Steam Verification Required' : 'Sign In Required'}
                            </h1>
                            <p className="text-sm text-fg-muted">
                                {tournament?.steamSignupEnabled
                                    ? 'Sign in with Steam so the organizer can verify who is playing, and so your invite link knows it is you.'
                                    : 'Registration is tied to your account, so sign in before entering a team.'}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={() => signIn('steam', { callbackUrl })}>
                            <Gamepad2 size={16} />
                            Continue with Steam
                        </Button>
                        {session && !sessionSteamId && (
                            <Button variant="secondary" type="button" onClick={() => signOut({ callbackUrl })}>
                                Switch Account
                            </Button>
                        )}
                    </div>
                    <MockPersonaButtons callbackUrl={callbackUrl} />
                </Card>
            </RegisterShell>
        );
    }

    if (inviteCode && tournament?.steamSignupEnabled) {
        return (
            <RegisterShell tournament={tournament}>
                <Card className="space-y-5">
                    <div className="flex items-start gap-3">
                        <Users className="mt-0.5 shrink-0 text-brand" size={22} />
                        <div className="space-y-1">
                            <h1 className="font-brand text-xl font-bold">Join Existing Team</h1>
                            <p className="text-sm text-fg-muted">
                                You have been invited to a team in{' '}
                                <span className="mds-name text-fg">{tournament.name}</span>.
                            </p>
                        </div>
                    </div>

                    <div className="rounded border border-line bg-field/40 px-4 py-3">
                        <p className="mds-uppercase-label text-fg-subtle">Invite code</p>
                        <p className="mds-numeric mt-0.5 text-xl font-bold tracking-[0.12em] text-brand">
                            {inviteCode}
                        </p>
                    </div>

                    {/* Optional, but strongly prompted: the seat is how marshals find you. */}
                    <div className="max-w-[14rem]">
                        <Input
                            id="join-seating"
                            label="Your seat (optional)"
                            hint={SEAT_HELPER_TEXT}
                            type="text"
                            value={seating}
                            maxLength={SEAT_MAX_LENGTH}
                            onChange={(e) => setSeating(e.target.value)}
                            className="mds-numeric h-11 px-4 text-sm font-bold"
                            placeholder="e.g. B12"
                        />
                    </div>

                    {error && <ErrorNotice message={error} />}

                    <Button onClick={handleJoinTeam} disabled={submitting}>
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        Join Roster
                    </Button>
                </Card>
            </RegisterShell>
        );
    }

    return (
        <RegisterShell tournament={tournament}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <Card className="space-y-5">
                    <div className="space-y-1">
                        <h1 className="font-brand text-xl font-bold">Create your team</h1>
                        <p className="text-sm text-fg-muted">
                            {tournament?.steamSignupEnabled
                                ? `You lead the team. Once it exists you get an invite link for the other ${Math.max(0, (tournament?.teamSize || 1) - 1)} players.`
                                : 'Enter the whole roster — this tournament is not using Steam sign-up.'}
                        </p>
                    </div>

                    <Input
                        id="team-name"
                        label="Team name"
                        type="text"
                        required
                        value={teamData.name}
                        onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
                        className="h-11 px-4 text-sm"
                        placeholder="Enter unique team name"
                    />

                    <div className="space-y-1.5">
                        <label className="mds-uppercase-label" htmlFor="team-logo">
                            Team logo (optional)
                        </label>
                        <div className="relative h-11">
                            <input
                                id="team-logo"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setLogoFile(file);
                                        setLogoPreview(URL.createObjectURL(file));
                                    }
                                }}
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                            />
                            <div className="mds-input flex h-full items-center justify-between px-4">
                                <span className="truncate text-sm text-fg-subtle">
                                    {logoFile ? logoFile.name : 'Upload PNG or JPG'}
                                </span>
                                <Upload size={15} className="shrink-0 text-fg-subtle" />
                            </div>
                        </div>
                    </div>

                    {/* Seat for the registering player. Optional, but the LAN runs on it:
                        the signup route stores it on this player's own row. */}
                    {tournament?.steamSignupEnabled && (
                        <div className="max-w-[14rem]">
                            <Input
                                id="create-seating"
                                label="Your seat (optional)"
                                hint={SEAT_HELPER_TEXT}
                                type="text"
                                value={seating}
                                maxLength={SEAT_MAX_LENGTH}
                                onChange={(e) => setSeating(e.target.value)}
                                className="mds-numeric h-11 px-4 text-sm font-bold"
                                placeholder="e.g. B12"
                            />
                        </div>
                    )}

                    {(teamData.name || logoPreview) && (
                        <div className="flex items-center gap-4 rounded border border-line bg-field/40 p-4">
                            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-page">
                                {logoPreview ? (
                                    <Image src={logoPreview} alt="" fill className="object-contain p-2" />
                                ) : (
                                    <Users size={20} className="text-fg-subtle" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="mds-uppercase-label text-fg-subtle">Your team</p>
                                <p className="mds-name-lg text-lg">{teamData.name || 'Unnamed team'}</p>
                            </div>
                        </div>
                    )}
                </Card>

                {!tournament?.steamSignupEnabled && (
                    <Card className="space-y-4">
                        <p className="mds-uppercase-label text-fg-subtle">
                            Roster ({tournament?.teamSize} players)
                        </p>
                        <div className="space-y-3">
                            {teamData.players.map((player, i) => (
                                <div
                                    key={i}
                                    className="grid grid-cols-1 gap-3 rounded border border-line bg-field/30 p-3 sm:grid-cols-2"
                                >
                                    <Input
                                        label={`Player ${i + 1}`}
                                        type="text"
                                        required
                                        value={player.name}
                                        onChange={(e) => updatePlayer(i, 'name', e.target.value)}
                                        className="h-10 px-3 text-sm"
                                        placeholder="Nickname or full name"
                                    />
                                    <Input
                                        label="Steam profile / ID"
                                        type="text"
                                        required
                                        value={player.steamId}
                                        onChange={(e) => updatePlayer(i, 'steamId', e.target.value)}
                                        className="mds-numeric h-10 px-3 text-sm"
                                        placeholder="Steam profile link or ID64"
                                    />
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {error && <ErrorNotice message={error} />}

                <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    {submitting ? 'Submitting…' : 'Complete Registration'}
                </Button>
            </form>
        </RegisterShell>
    );
}
