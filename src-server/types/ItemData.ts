export interface ItemData {
    id: number;
    userId: string;
    music: {
        isUrl: boolean | null,
        title: string | null,
        path: string | null,
        stream: boolean,
        ytId?: string,
    },
    pic: {
        exists: boolean,
        isUrl: boolean | null,
        title: string | null,
        path: string | null,
    },
    duration: number,
    startTime: string | null,
    endTime: string | null,
};
