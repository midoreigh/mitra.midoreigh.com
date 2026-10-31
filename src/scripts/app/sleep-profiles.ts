// Sleep Profiles logic, identical to Mitra on Mac and Android.

export interface SleepProfile {
  id: string;
  name: string;
  temperatures: number[];
  turnsOffAtEnd: boolean;
}

export const GENTLE_PROFILE: SleepProfile = {
  id: 'default',
  name: 'Gentle',
  temperatures: [24, 24, 24, 25, 25, 25, 26, 26],
  turnsOffAtEnd: true,
};

export function scheduleForProfile(profile: SleepProfile, currentSetpoint: number): number[] {
  if (profile.id === 'default') {
    return profile.temperatures.map((t) => currentSetpoint + t - profile.temperatures[0]);
  }
  return [...profile.temperatures];
}

export function wireTemperatures(profile: SleepProfile, currentSetpoint: number): string[] {
  const sched = scheduleForProfile(profile, currentSetpoint);
  const formatted = sched.map((t) => t.toFixed(1));
  if (profile.turnsOffAtEnd) {
    formatted.push('00.0');
  }
  return formatted;
}

const STORAGE_KEY = 'mitra_sleep_profiles';

export function loadSavedProfiles(): SleepProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [GENTLE_PROFILE];
    const list: SleepProfile[] = JSON.parse(raw);
    if (!list.some((p) => p.id === 'default')) {
      list.unshift(GENTLE_PROFILE);
    }
    return list;
  } catch {
    return [GENTLE_PROFILE];
  }
}

export function saveProfiles(profiles: SleepProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // ignore
  }
}

export function generateProfileId(): string {
  return Math.random().toString(36).slice(2, 12);
}
