'use client';

import type { AuthUser, LoginResponse, Role } from '@garagentor/shared';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, setSessionExpiredHandler, tokenStore } from './api-client';
import { dienstDatenVerwerfen } from './dienst';

interface AuthContextValue {
  user: AuthUser | null;
  /** Solange die gespeicherte Sitzung geprüft wird. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Prüft, ob der angemeldete Benutzer eine der Rollen hat. */
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Beim Start wird eine gespeicherte Sitzung gegen die API geprüft.
  useEffect(() => {
    let active = true;

    async function restore() {
      if (!tokenStore.access) {
        if (active) setLoading(false);
        return;
      }

      try {
        const me = await api.get<AuthUser>('/auth/me');
        if (active) setUser(me);
        tokenStore.setBenutzer(me);
      } catch (fehler) {
        // Nur eine Absage des Servers beendet die Sitzung. War er dagegen
        // nicht zu erreichen – Funkloch in der Halle, kurzer Ausfall –, gilt
        // der zuletzt bekannte Benutzer weiter. Vorher warf jeder abgebrochene
        // Aufruf die Tokens weg und meldete jemanden mitten in der Arbeit ab.
        const abgelehnt =
          fehler instanceof ApiError && (fehler.status === 401 || fehler.status === 403);
        const zwischenstand = tokenStore.benutzer;
        if (abgelehnt || !zwischenstand) {
          tokenStore.clear();
        } else if (active) {
          setUser(zwischenstand);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void restore();
    return () => {
      active = false;
    };
  }, []);

  // Läuft die Sitzung während der Nutzung ab, wird zur Anmeldung geleitet.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      router.replace('/login');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.postAnonymous<LoginResponse>('/auth/login', { email, password });
    tokenStore.set(response);
    tokenStore.setBenutzer(response.user);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refresh;
    try {
      if (refreshToken) {
        await api.postAnonymous('/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Ein fehlgeschlagener Abmeldeaufruf darf das lokale Abmelden nicht
      // verhindern – die Tokens werden in jedem Fall verworfen.
      if (!(error instanceof ApiError)) throw error;
    } finally {
      tokenStore.clear();
      // Die abgelegten Daten hängen an der Adresse, nicht am Token: ohne
      // dieses Verwerfen sähe auf einem geteilten Tablet die nächste Person
      // den Stand der vorigen.
      await dienstDatenVerwerfen();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!user) return false;
      // Administratoren haben Zugriff auf alle Bereiche.
      return user.role === 'ADMIN' || roles.includes(user.role);
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, hasRole }),
    [user, loading, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.');
  }
  return context;
}
