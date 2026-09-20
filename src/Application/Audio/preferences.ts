const GARAGE_MUTED_KEY = 'cofounder:garage-muted';

export const getInitialGarageMuted = () => {
    const saved = window.localStorage.getItem(GARAGE_MUTED_KEY);
    if (saved !== null) return saved === 'true';
    return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches;
};

export const saveGarageMuted = (muted: boolean) => {
    window.localStorage.setItem(GARAGE_MUTED_KEY, String(muted));
};
