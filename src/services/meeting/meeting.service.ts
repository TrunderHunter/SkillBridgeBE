import jwt from 'jsonwebtoken';
import { logger } from '../../utils/logger';

type Platform = 'ZOOM' | 'GOOGLE_MEET' | 'MICROSOFT_TEAMS' | 'OTHER';

interface ProvisionContext {
    title: string;
    startDate: Date;
    schedule: { dayOfWeek: number[]; startTime: string; endTime: string };
}

interface OnlineInfo {
    platform: Platform;
    meetingLink?: string;
    meetingId?: string;
    password?: string;
}

/**
 * Provision an online meeting link.
 * Switched to Jitsi (JaaS) by default. Returns a base join URL (no JWT).
 * A role-based moderator URL with JWT can be built via buildJitsiModeratorUrl.
 */
export async function provisionOnlineMeeting(
    preferredPlatform: Platform,
    context: ProvisionContext
): Promise<OnlineInfo | undefined> {
    try {
        const info = await tryProvisionJitsi(context);
        if (info) return info;
    } catch (err) {
        logger.warn('Provision Jitsi failed', err);
    }
    return undefined;
}

async function tryProvisionJitsi(context: ProvisionContext): Promise<OnlineInfo | undefined> {
    const baseUrl = process.env.JITSI_BASE_URL || 'https://8x8.vc';
    const tenant = process.env.JITSI_TENANT;
    const publicEnabled = (process.env.JITSI_PUBLIC_ENABLED || '').toLowerCase() === 'true';
    const publicBaseUrl = process.env.JITSI_PUBLIC_BASE_URL || 'https://meet.jit.si';

    const roomName = generateReadableRoomName(context.title);

    // PUBLIC MODE (no moderator/login required): use meet.jit.si when enabled or tenant missing
    if (publicEnabled || !tenant) {
        if (!tenant) {
            logger.warn('JITSI_TENANT not configured; falling back to public Jitsi (meet.jit.si).');
        }
        const meetingLink = `${publicBaseUrl.replace(/\/$/, '')}/${roomName}`;
        return {
            platform: 'OTHER',
            meetingLink,
            meetingId: roomName,
            password: undefined,
        };
    }

    // JaaS (8x8.vc) tenant mode: requires a moderator (JWT) to start the meeting
    const meetingLink = `${baseUrl.replace(/\/$/, '')}/${tenant}/${roomName}`;
    return {
        platform: 'OTHER', // keep enums unchanged; we use Jitsi under OTHER
        meetingLink,
        meetingId: roomName,
        password: undefined,
    };
}

function generateReadableRoomName(title: string): string {
    const normalized = (title || 'skillbridge-class')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return `${normalized || 'class'}-${suffix}`;
}

/**
 * Build a Jitsi (JaaS) moderator URL with JWT for a given room.
 * Returns undefined if JaaS credentials are missing.
 */
export function buildJitsiModeratorUrl(params: {
    roomName: string;
    displayName?: string;
    email?: string;
    expiresInSeconds?: number;
}): string | undefined {
    const appId = process.env.JITSI_APP_ID; // used as 'kid' in header
    const appSecret = process.env.JITSI_APP_SECRET; // HS256 secret
    const tenant = process.env.JITSI_TENANT;
    const baseUrl = process.env.JITSI_BASE_URL || 'https://8x8.vc';
    if (!appId || !appSecret || !tenant) {
        return undefined;
    }
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (params.expiresInSeconds || 2 * 60 * 60);
    const payload: any = {
        aud: 'jitsi',
        iss: 'chat',
        sub: tenant,
        room: params.roomName,
        exp,
        nbf: now - 10,
        context: {
            user: {
                name: params.displayName || 'Tutor',
                email: params.email,
                moderator: true,
            },
        },
    };
    const token = jwt.sign(payload, appSecret as jwt.Secret, {
        algorithm: 'HS256',
        header: { kid: appId, alg: 'HS256' },
    });
    const url = `${baseUrl.replace(/\/$/, '')}/${tenant}/${params.roomName}#jwt=${token}`;
    return url;
}


