import { OverlayMedium } from "./UploadData";

export interface PublicItemData {
    duration: number;
    id: number;
    image?: {
        medium: OverlayMedium;
        title: string;
        url: string | undefined;
    };
    musicDownloadUrl?: string;
    nickname: string;
    title: string;
    userId: string;
}
