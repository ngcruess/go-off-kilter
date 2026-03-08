import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, GradeSystem } from '../types';
import { createUser, getUser } from '../api/client';

const USER_STORAGE_KEY = 'go_off_kilter_user_id';
const ANGLE_STORAGE_KEY = 'go_off_kilter_angle';
const GRADE_SYSTEM_KEY = 'go_off_kilter_grade_system';
const DEFAULT_ANGLE = 40;
const DEFAULT_GRADE_SYSTEM: GradeSystem = 'hueco';

interface SessionContextValue {
  user: User | null;
  loading: boolean;
  angle: number;
  gradeSystem: GradeSystem;
  boardConnected: boolean;
  setAngle: (angle: number) => void;
  setGradeSystem: (system: GradeSystem) => void;
  setBoardConnected: (connected: boolean) => void;
  login: (username: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  angle: DEFAULT_ANGLE,
  gradeSystem: DEFAULT_GRADE_SYSTEM,
  boardConnected: false,
  setAngle: () => {},
  setGradeSystem: () => {},
  setBoardConnected: () => {},
  login: async () => {},
  logout: async () => {},
});

export const useUser = () => useContext(SessionContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [angle, setAngleState] = useState(DEFAULT_ANGLE);
  const [gradeSystem, setGradeSystemState] = useState<GradeSystem>(DEFAULT_GRADE_SYSTEM);
  const [boardConnected, setBoardConnected] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedId, storedAngle, storedGradeSystem] = await AsyncStorage.multiGet([
          USER_STORAGE_KEY,
          ANGLE_STORAGE_KEY,
          GRADE_SYSTEM_KEY,
        ]);
        if (storedAngle[1]) {
          setAngleState(parseInt(storedAngle[1], 10));
        }
        if (storedGradeSystem[1] === 'font' || storedGradeSystem[1] === 'hueco') {
          setGradeSystemState(storedGradeSystem[1]);
        }
        if (storedId[1]) {
          const u = await getUser(parseInt(storedId[1], 10));
          setUser(u);
        }
      } catch {
        // User not found or server down — stay logged out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setAngle = (newAngle: number) => {
    setAngleState(newAngle);
    AsyncStorage.setItem(ANGLE_STORAGE_KEY, String(newAngle));
  };

  const setGradeSystem = (system: GradeSystem) => {
    setGradeSystemState(system);
    AsyncStorage.setItem(GRADE_SYSTEM_KEY, system);
  };

  const login = async (username: string) => {
    const u = await createUser(username);
    await AsyncStorage.setItem(USER_STORAGE_KEY, String(u.id));
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
  };

  return (
    <SessionContext.Provider value={{ user, loading, angle, gradeSystem, boardConnected, setAngle, setGradeSystem, setBoardConnected, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
};
