import { UrlPic, FilePic, NoPic } from "./UploadData";

export interface ItemData {
    id: number;
    userId: string;
    music: CompleteMusic;
    pic: CompletePicture;
    duration: number;
    startTime: number | null;
    endTime: number | null;
    timePlayedAt?: number;
};

export type CompleteMusic = {
    isUrl: boolean,
    hash: number,
    path: string,
    stream: false,
    title: string,
    ytId?: string,
} | {
    isUrl: boolean,
    hash: undefined,
    path: string,
    stream: true,
    title: string,
    ytId?: string,
}

export type CompleteUrlPic = UrlPic & {
    title: string;
};

export type CompletePicture = CompleteUrlPic | FilePic | NoPic;
