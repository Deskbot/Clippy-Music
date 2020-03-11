export interface UploadData {
	duration?: number;
	id?: number;
	userId?: string;
	music: UrlMusic | FileMusic;
	overlay: UrlOverlay | FileOverlay | NoOverlay;
	startTime: number | null;
	endTime: number | null;
};

export interface UrlMusic {
	isUrl: true;
	url: string;
	title?: string;
}

export interface FileMusic {
	isUrl: false;
	path: string;
	title: string;
}

export enum OverlayMedium {
	Image,
	Video,
}

export interface UrlOverlay {
	exists: true;
	isUrl: true;
	medium: OverlayMedium;
	url: string;
	title?: string;
}

export interface FileOverlay {
	exists: true;
	isUrl: false;
	medium: OverlayMedium;
	path: string;
	title: string;
}

export interface NoOverlay {
	exists: false;
	isUrl: undefined;
	path: undefined;
	title: undefined;
}

export interface UploadDataWithId extends UploadData {
	id: number;
	userId: string;
}

export interface UploadDataWithIdTitleDuration extends UploadDataWithId {
	duration: number;
	music: MusicWithMetadata;
}

export type MusicWithMetadata = (
	UrlMusic & {
		uniqueId: string;
		title: string;
		totalFileDuration: number;
	}
) | (
	FileMusic & {
		title: string;
	}
);
