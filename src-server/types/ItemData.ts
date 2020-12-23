import { UrlOverlay, FileOverlay, NoOverlay, OverlayMedium } from "./UploadData";

export interface ItemData {
	id: number;
	userId: string;
	music: CompleteMusic;
	overlay: CompleteOverlay;
	duration: number;
	startTime: number | null;
	endTime: number | null;
	timePlayedAt?: number;
	timeUploaded: number;
};

export type CompleteMusic = {
	isUrl: false,
	hash: number,
	path: string,
	stream: false,
	title: string,
} | {
	isUrl: true,
	hash: undefined,
	stream: true,
	title: string,
	uniqueId: string;
	url: string;
} | {
	isUrl: true,
	hash: number,
	path: string,
	stream: false,
	title: string,
	uniqueId: string;
	url: string;
};

export interface StreamedUrlOverlay extends UrlOverlay {
	hash: undefined;
	medium: OverlayMedium;
	stream: true;
}

export interface RawUrlOrYtDlOverlay extends UrlOverlay {
	hash: number;
	medium: OverlayMedium;
	path: string;
	stream: false;
	title: string;
};

export type CompleteUrlOverlay = RawUrlOrYtDlOverlay | StreamedUrlOverlay;

export interface CompleteFileOverlay extends FileOverlay {
	hash: number;
	stream: false;
};

export interface CompleteNoOverlay extends NoOverlay {
	hash: undefined;
	stream: false;
}

export type CompleteOverlay = CompleteUrlOverlay | CompleteFileOverlay | CompleteNoOverlay;
