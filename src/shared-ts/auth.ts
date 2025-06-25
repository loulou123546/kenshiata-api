import { type HttpRequest, type HttpResponse } from "@architect/functions/types/http";
import * as jose from 'jose'

export type UserIdentity = {
    id: string,
    username: string,
    groups: string[]
}

export type AuthHttpRequest = HttpRequest & {
    user?: UserIdentity
}

export function authRequired (inOneOfGroups: string[] | undefined = undefined): (req: AuthHttpRequest) => Promise<HttpResponse | undefined> {

    const JWKS = jose.createRemoteJWKSet(new URL("https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_Fzpf4i9XY/.well-known/jwks.json"))

    return async (req: AuthHttpRequest) => {
        const token = req.headers?.authorization;
        if (!token) {
            return { statusCode: 401, body: 'Unauthorized' };
        }
        if (!token.startsWith('Bearer ')) {
            return { statusCode: 401, body: 'Invalid token' };
        }
        try {
            const jwt_token = token.replace('Bearer ', '');
            const { payload, protectedHeader } = await jose.jwtVerify(jwt_token, JWKS, {
                issuer: 'https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_Fzpf4i9XY',
                // audience: '203t0a306t5vkid4kdeto2hs2i', // available only for id token, not for access token
                clockTolerance: "5 minutes",
                maxTokenAge: "2 hours",
                requiredClaims: ["client_id", "sub", "username"]
            })
            // for AWS Cognito, client_id replace audience `aud`
            if (payload.client_id !== '203t0a306t5vkid4kdeto2hs2i') {
                return { statusCode: 401, body: 'Invalid audience' };
            }
            if (!payload.sub || !payload.username) {
                return { statusCode: 401, body: 'Invalid token' };
            }
            const groups = Array.isArray(payload?.["cognito:groups"]) ? payload["cognito:groups"] : [];
    
            if (inOneOfGroups && inOneOfGroups.length >= 1) {
                const hasGroup = inOneOfGroups.some(group => groups.includes(group));
                if (!hasGroup) {
                    return { statusCode: 403, body: 'Forbidden' };
                }
            }
            req.user = {
                id: payload.sub,
                username: payload.username as string,
                groups: groups
            };
            // user is authenticated, return undefined to continue processing the request
        }
        catch {
            return { statusCode: 401, body: 'Invalid token' };
        }
    };
}
