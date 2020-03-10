export interface UploadData {
	duration?: number;
	id?: number;
	userId?: string;
	music: UrlMusic | FileMusic;
	overlay: UrlImage | FileImage | NoImage;
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

export interface UrlImage {
	exists: true;
	isUrl: true;
	url: string;
	title?: string;
}

export interface FileImage {
	exists: true;
	isUrl: false;
	path: string;
	title: string;
}

export interface NoImage {
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
