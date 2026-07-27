import type { Role } from '../enums';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  employeeId: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Restlaufzeit des Access-Tokens in Sekunden. */
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}

/** Nutzlast des signierten Access-Tokens. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  /** Token-Typ, verhindert die Verwendung eines Refresh- als Access-Token. */
  typ: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
