export interface PublicItemData {
    musicDownloadLink?: string;
    imageDownloadLink?: string;
    duration: number;
    id: number;
    nickname: string;
    title: string;
    userId: string;
    image?: {
        link: string | undefined;
        title: string;
    }
}
