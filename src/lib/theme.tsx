import { createContext, useContext } from 'react';

export const DarkModeContext = createContext(false);
export function useIsDark() { return useContext(DarkModeContext); }
