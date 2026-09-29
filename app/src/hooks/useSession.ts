import { useCallback, useEffect, useState } from "react";
import type { Platform } from "../platform.js";

export interface Session {
  /** undefined là chưa đọc xong bộ nhớ, null là chưa đăng nhập. */
  token: string | null | undefined;
  signOut: () => Promise<void>;
  forget: () => Promise<void>;
}

export function useSession(platform: Platform): Session {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    platform.getToken().then(setToken);
    return platform.onTokenChange(setToken);
  }, [platform]);

  const forget = useCallback(async () => {
    await platform.clearToken();
    setToken(null);
  }, [platform]);

  const signOut = useCallback(async () => {
    const current = await platform.getToken();
    if (current) await platform.api.logout(current);
    await platform.setActiveWorkspace(null);
    await forget();
  }, [platform, forget]);

  return { token, signOut, forget };
}
