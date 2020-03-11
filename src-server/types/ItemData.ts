import { UrlOverlay, FileOverlay, NoOverlay } from "./UploadData";

export interface ItemData {
	id: number;
	userId: string;
	music: CompleteMusic;
	overlay: CompleteOverlay;
	duration: number;
	startTime: number | null;
	endTime: number | null;
	timePlayedAt?: number;
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
}

export interface CompleteUrlOverlay extends UrlOverlay {
	hash: number;
	path: string;
	title: string;
};

export interface CompleteFileOverlay extends FileOverlay {
	hash: number;
};

export interface CompleteNoOverlay extends NoOverlay {
	hash: undefined;
}

export type CompleteOverlay = CompleteUrlOverlay | CompleteFileOverlay | CompleteNoOverlay;
